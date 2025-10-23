import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Server, Plus, Edit2, Trash2, X, Save, Eye, EyeOff, Bell } from 'lucide-react';

interface ConfiguracionServidor {
  id: string;
  tipo_servidor: 'smtp' | 'imap' | 'pop3';
  host: string;
  puerto: number;
  usuario: string;
  password_encriptado: string;
  usa_ssl: boolean;
  usa_tls: boolean;
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
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionServidor[]>([]);
  const [notificacionConfig, setNotificacionConfig] = useState<ConfiguracionNotificacion | null>(null);
  const [emailsNotificacion, setEmailsNotificacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfiguracionServidor | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    tipo_servidor: 'smtp' as const,
    host: '',
    puerto: 587,
    usuario: '',
    password_encriptado: '',
    usa_ssl: false,
    usa_tls: true,
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
      supabase.from('configuracion_servidor_correo').select('*').order('tipo_servidor'),
      supabase.from('configuracion_notificaciones').select('*').eq('clave', 'emails_notificaciones_internas').maybeSingle(),
    ]);

    if (configRes.error) {
      console.error('Error loading server configs:', configRes.error);
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
      tipo_servidor: 'smtp',
      host: '',
      puerto: 587,
      usuario: '',
      password_encriptado: '',
      usa_ssl: false,
      usa_tls: true,
      email_remitente: '',
      nombre_remitente: '',
      activo: false,
    });
    setShowModal(true);
  };

  const handleEdit = (config: ConfiguracionServidor) => {
    setEditingConfig(config);
    setFormData({
      tipo_servidor: config.tipo_servidor,
      host: config.host,
      puerto: config.puerto,
      usuario: config.usuario,
      password_encriptado: '',
      usa_ssl: config.usa_ssl,
      usa_tls: config.usa_tls,
      email_remitente: config.email_remitente,
      nombre_remitente: config.nombre_remitente,
      activo: config.activo,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setMessage(null);

    if (!formData.host || !formData.usuario || !formData.email_remitente || !formData.nombre_remitente) {
      setMessage({ type: 'error', text: 'Completa todos los campos requeridos' });
      return;
    }

    if (!editingConfig && !formData.password_encriptado) {
      setMessage({ type: 'error', text: 'La contraseña es requerida' });
      return;
    }

    try {
      if (formData.activo && formData.tipo_servidor === 'smtp') {
        await supabase
          .from('configuracion_servidor_correo')
          .update({ activo: false })
          .eq('tipo_servidor', 'smtp')
          .neq('id', editingConfig?.id || '00000000-0000-0000-0000-000000000000');
      }

      const dataToSave: any = {
        tipo_servidor: formData.tipo_servidor,
        host: formData.host,
        puerto: formData.puerto,
        usuario: formData.usuario,
        usa_ssl: formData.usa_ssl,
        usa_tls: formData.usa_tls,
        email_remitente: formData.email_remitente,
        nombre_remitente: formData.nombre_remitente,
        activo: formData.activo,
        updated_at: new Date().toISOString(),
      };

      if (formData.password_encriptado) {
        dataToSave.password_encriptado = formData.password_encriptado;
      }

      if (editingConfig) {
        const { error } = await supabase
          .from('configuracion_servidor_correo')
          .update(dataToSave)
          .eq('id', editingConfig.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Configuración actualizada correctamente' });
      } else {
        const { error } = await supabase
          .from('configuracion_servidor_correo')
          .insert(dataToSave);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Configuración creada correctamente' });
      }

      setShowModal(false);
      loadConfiguraciones();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;

    try {
      const { error } = await supabase
        .from('configuracion_servidor_correo')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Configuración eliminada correctamente' });
      loadConfiguraciones();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleToggleActivo = async (config: ConfiguracionServidor) => {
    try {
      if (!config.activo && config.tipo_servidor === 'smtp') {
        await supabase
          .from('configuracion_servidor_correo')
          .update({ activo: false })
          .eq('tipo_servidor', 'smtp')
          .neq('id', config.id);
      }

      const { error } = await supabase
        .from('configuracion_servidor_correo')
        .update({
          activo: !config.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;
      setMessage({ type: 'success', text: `Configuración ${!config.activo ? 'activada' : 'desactivada'}` });
      loadConfiguraciones();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const tipoLabels = {
    smtp: 'SMTP (Envío)',
    imap: 'IMAP (Recepción)',
    pop3: 'POP3 (Recepción)',
  };

  const puertosComunes = {
    smtp: { ssl: 465, tls: 587 },
    imap: { ssl: 993, tls: 143 },
    pop3: { ssl: 995, tls: 110 },
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
          <Server className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">Configuración del servidor de correo</h3>
            <p className="text-sm text-blue-800">
              Configura los servidores de correo para enviar y recibir mensajes. Solo puede haber una
              configuración SMTP activa a la vez para envío de correos.
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
          <Server className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No hay configuraciones de servidor</p>
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
                      {tipoLabels[config.tipo_servidor]}
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded uppercase">
                      {config.tipo_servidor}
                    </span>
                    {config.activo && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Activo
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <strong>Host:</strong> {config.host}
                    </div>
                    <div>
                      <strong>Puerto:</strong> {config.puerto}
                    </div>
                    <div>
                      <strong>Usuario:</strong> {config.usuario}
                    </div>
                    <div>
                      <strong>Remitente:</strong> {config.nombre_remitente} &lt;{config.email_remitente}&gt;
                    </div>
                    <div>
                      <strong>SSL:</strong> {config.usa_ssl ? 'Sí' : 'No'}
                    </div>
                    <div>
                      <strong>TLS:</strong> {config.usa_tls ? 'Sí' : 'No'}
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
                {editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Servidor</label>
                <select
                  value={formData.tipo_servidor}
                  onChange={(e) => {
                    const tipo = e.target.value as 'smtp' | 'imap' | 'pop3';
                    setFormData({
                      ...formData,
                      tipo_servidor: tipo,
                      puerto: formData.usa_ssl
                        ? puertosComunes[tipo].ssl
                        : puertosComunes[tipo].tls,
                    });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="smtp">SMTP (Envío)</option>
                  <option value="imap">IMAP (Recepción)</option>
                  <option value="pop3">POP3 (Recepción)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Host *</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Puerto *</label>
                  <input
                    type="number"
                    value={formData.puerto}
                    onChange={(e) => setFormData({ ...formData, puerto: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Usuario *</label>
                <input
                  type="text"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  placeholder="tu-email@dominio.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña {editingConfig && '(dejar vacío para mantener)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password_encriptado}
                    onChange={(e) => setFormData({ ...formData, password_encriptado: e.target.value })}
                    placeholder={editingConfig ? 'Nueva contraseña (opcional)' : 'Contraseña'}
                    className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Remitente *</label>
                  <input
                    type="email"
                    value={formData.email_remitente}
                    onChange={(e) => setFormData({ ...formData, email_remitente: e.target.value })}
                    placeholder="noreply@empresa.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.usa_ssl}
                    onChange={(e) => {
                      const usaSSL = e.target.checked;
                      setFormData({
                        ...formData,
                        usa_ssl: usaSSL,
                        puerto: usaSSL
                          ? puertosComunes[formData.tipo_servidor].ssl
                          : puertosComunes[formData.tipo_servidor].tls,
                      });
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Usar SSL</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.usa_tls}
                    onChange={(e) => setFormData({ ...formData, usa_tls: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Usar TLS</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Activo</span>
                </label>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <strong>Puertos comunes:</strong>
                <div className="mt-1">
                  SMTP: 587 (TLS), 465 (SSL) | IMAP: 143 (TLS), 993 (SSL) | POP3: 110 (TLS), 995 (SSL)
                </div>
              </div>
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
