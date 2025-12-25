import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Send, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConfiguracionSMTPProps {
  config: any;
  onConfigSaved: () => void;
}

export function ConfiguracionSMTP({ config, onConfigSaved }: ConfiguracionSMTPProps) {
  const [formData, setFormData] = useState({
    tipo_integracion: 'resend' as 'smtp' | 'sendgrid' | 'resend',
    servidor: '',
    puerto: 587,
    usuario: '',
    password: '',
    seguridad: 'tls' as 'tls' | 'ssl' | 'none',
    api_key: '',
    resend_api_key: '',
    remitente_nombre: '',
    remitente_email: '',
    activo: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testAsunto, setTestAsunto] = useState('Prueba de Correo - MOVI Digital');
  const [testMensaje, setTestMensaje] = useState('Hola!\n\nEste es un mensaje de prueba del sistema de notificaciones por correo electrónico de MOVI Digital.\n\nSi recibes este correo, la configuración está funcionando correctamente. ✅\n\nSaludos,\nEquipo MOVI Digital');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        tipo_integracion: config.tipo_integracion || 'resend',
        servidor: config.servidor || '',
        puerto: config.puerto || 587,
        usuario: config.usuario || '',
        password: '',
        seguridad: config.seguridad || 'tls',
        api_key: '',
        resend_api_key: '',
        remitente_nombre: config.remitente_nombre || '',
        remitente_email: config.remitente_email || '',
        activo: config.activo || false
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const dataToSave: any = {
        tipo_integracion: formData.tipo_integracion,
        remitente_nombre: formData.remitente_nombre,
        remitente_email: formData.remitente_email,
        activo: formData.activo,
        configurado_por: (await supabase.auth.getUser()).data.user?.id,
        fecha_configuracion: new Date().toISOString()
      };

      if (formData.tipo_integracion === 'smtp') {
        dataToSave.servidor = formData.servidor;
        dataToSave.puerto = formData.puerto;
        dataToSave.usuario = formData.usuario;
        dataToSave.seguridad = formData.seguridad;
        if (formData.password) {
          dataToSave.password_encriptado = formData.password;
        }
      } else if (formData.tipo_integracion === 'sendgrid') {
        if (formData.api_key) {
          dataToSave.api_key_encriptada = formData.api_key;
        }
      } else if (formData.tipo_integracion === 'resend') {
        if (formData.resend_api_key) {
          dataToSave.resend_api_key = formData.resend_api_key;
        }
      }

      if (config?.id) {
        const { error } = await supabase
          .from('correo_configuracion')
          .update(dataToSave)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('correo_configuracion')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
      onConfigSaved();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      setMessage({ type: 'error', text: error.message || 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setMessage({ type: 'error', text: 'Ingresa un correo para la prueba' });
      return;
    }

    if (!testAsunto.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un asunto para el correo' });
      return;
    }

    if (!testMensaje.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un mensaje para el correo' });
      return;
    }

    setMessage(null);
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('test-email', {
        body: {
          destinatario: testEmail,
          asunto: testAsunto,
          mensaje: testMensaje
        }
      });

      if (error) throw error;

      setMessage({
        type: data?.success ? 'success' : 'error',
        text: data?.success
          ? `✅ Correo enviado exitosamente a ${data.destinatario}${data.resend_id ? ` (ID: ${data.resend_id})` : ''}`
          : `❌ ${data?.error || 'Error al enviar correo de prueba'}`
      });

      if (data?.success) {
        onConfigSaved();
      }
    } catch (error: any) {
      console.error('Error al enviar prueba:', error);
      setMessage({ type: 'error', text: error.message || 'Error al enviar correo de prueba' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-accent-50 text-accent-800 border border-accent-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Integración */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Tipo de Integración
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="resend"
                checked={formData.tipo_integracion === 'resend'}
                onChange={(e) => setFormData({ ...formData, tipo_integracion: e.target.value as 'resend' })}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-neutral-700 font-medium">Resend (Recomendado)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="smtp"
                checked={formData.tipo_integracion === 'smtp'}
                onChange={(e) => setFormData({ ...formData, tipo_integracion: e.target.value as 'smtp' })}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-neutral-700">SMTP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="sendgrid"
                checked={formData.tipo_integracion === 'sendgrid'}
                onChange={(e) => setFormData({ ...formData, tipo_integracion: e.target.value as 'sendgrid' })}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-neutral-700">SendGrid</span>
            </label>
          </div>
        </div>

        {/* Configuración SMTP */}
        {formData.tipo_integracion === 'smtp' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Servidor SMTP *
                </label>
                <input
                  type="text"
                  value={formData.servidor}
                  onChange={(e) => setFormData({ ...formData, servidor: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Puerto *
                </label>
                <input
                  type="number"
                  value={formData.puerto}
                  onChange={(e) => setFormData({ ...formData, puerto: parseInt(e.target.value) })}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Usuario *
              </label>
              <input
                type="text"
                value={formData.usuario}
                onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                required
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="usuario@dominio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Contraseña {config?.id && '(dejar en blanco para mantener actual)'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!config?.id}
                  className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Seguridad
              </label>
              <select
                value={formData.seguridad}
                onChange={(e) => setFormData({ ...formData, seguridad: e.target.value as any })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="tls">TLS</option>
                <option value="ssl">SSL</option>
                <option value="none">Ninguna</option>
              </select>
            </div>
          </>
        )}

        {/* Configuración SendGrid */}
        {formData.tipo_integracion === 'sendgrid' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              API Key {config?.id && '(dejar en blanco para mantener actual)'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                required={!config?.id}
                className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="SG.xxxx"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {/* Configuración Resend */}
        {formData.tipo_integracion === 'resend' && (
          <div className="space-y-4">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="text-sm text-primary-800">
                <strong>Resend</strong> es un servicio de email moderno y confiable. Obtén tu API key en{' '}
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                  resend.com/api-keys
                </a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Resend API Key {config?.id && '(dejar en blanco para mantener actual)'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.resend_api_key}
                  onChange={(e) => setFormData({ ...formData, resend_api_key: e.target.value })}
                  required={!config?.id}
                  className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="re_xxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                La API key comienza con "re_" y la puedes generar en tu dashboard de Resend
              </p>
            </div>
          </div>
        )}

        {/* Información del Remitente */}
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Información del Remitente</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Nombre del Remitente *
              </label>
              <input
                type="text"
                value={formData.remitente_nombre}
                onChange={(e) => setFormData({ ...formData, remitente_nombre: e.target.value })}
                required
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="MOVI Digital"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Email del Remitente *
              </label>
              <input
                type="email"
                value={formData.remitente_email}
                onChange={(e) => setFormData({ ...formData, remitente_email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="noreply@jiro.mx"
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <input
            type="checkbox"
            id="activo"
            checked={formData.activo}
            onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
          />
          <label htmlFor="activo" className="text-sm font-medium text-neutral-700 cursor-pointer">
            Activar sistema de envío de correos
          </label>
        </div>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>

      {/* Prueba de Envío */}
      {config?.id && (
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-primary-600" />
            Prueba de Envío por Correo
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Correo Destino *
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-neutral-600 mt-1">
                📧 Ingresa el correo donde recibirás el mensaje de prueba
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Asunto del Correo *
              </label>
              <input
                type="text"
                value={testAsunto}
                onChange={(e) => setTestAsunto(e.target.value)}
                placeholder="Asunto del mensaje..."
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-neutral-600 mt-1">
                📝 Personaliza el asunto del correo de prueba
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Mensaje Personalizado *
              </label>
              <textarea
                value={testMensaje}
                onChange={(e) => setTestMensaje(e.target.value)}
                rows={6}
                placeholder="Escribe tu mensaje de prueba aquí..."
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
              />
              <p className="text-xs text-neutral-600 mt-1">
                💬 Personaliza el contenido del correo. Se enviará con formato HTML automático.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing || !testEmail || !testAsunto.trim() || !testMensaje.trim()}
              className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Send className="w-5 h-5" />
              {testing ? 'Enviando correo...' : 'Enviar Prueba por Correo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
