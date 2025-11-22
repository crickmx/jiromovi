import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Send, Eye, EyeOff, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';

interface ConfiguracionWhatsAppProps {
  config: any;
  onConfigSaved: () => void;
}

export function ConfiguracionWhatsApp({ config, onConfigSaved }: ConfiguracionWhatsAppProps) {
  const [formData, setFormData] = useState({
    api_key: 'aeaecead58f14a3286b37e4d0b81dc3a',
    numero_remitente: '5215588545516',
    activo: false
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testNumero, setTestNumero] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (config) {
      setFormData({
        api_key: config.api_key || 'aeaecead58f14a3286b37e4d0b81dc3a',
        numero_remitente: config.numero_remitente || '5215588545516',
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
        api_key: formData.api_key,
        numero_remitente: formData.numero_remitente,
        activo: formData.activo,
        configurado_por: (await supabase.auth.getUser()).data.user?.id,
        ultima_actualizacion: new Date().toISOString()
      };

      if (config?.id) {
        const { error } = await supabase
          .from('whatsapp_configuracion')
          .update(dataToSave)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_configuracion')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Configuración de WhatsApp guardada exitosamente' });
      onConfigSaved();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      setMessage({ type: 'error', text: error.message || 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testNumero) {
      setMessage({ type: 'error', text: 'Ingresa un número para la prueba' });
      return;
    }

    setMessage(null);
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          tipo: 'bienvenida',
          numero: testNumero,
          datos: {
            nombre: 'Usuario de Prueba',
            apellidos: '',
            email: 'prueba@movi.digital',
            email_laboral: 'prueba@movi.digital',
            rol: 'Usuario de Prueba'
          }
        }
      });

      if (error) throw error;

      const updateData: any = {
        ultima_prueba: new Date().toISOString(),
        estado_ultima_prueba: data?.success ? 'Exitoso' : 'Fallido'
      };

      if (config?.id) {
        await supabase
          .from('whatsapp_configuracion')
          .update(updateData)
          .eq('id', config.id);
      }

      setMessage({
        type: data?.success ? 'success' : 'error',
        text: data?.success
          ? 'Mensaje de WhatsApp enviado exitosamente'
          : 'Error al enviar mensaje de WhatsApp'
      });

      onConfigSaved();
    } catch (error: any) {
      console.error('Error al enviar prueba:', error);
      setMessage({ type: 'error', text: error.message || 'Error al enviar mensaje de prueba' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <MessageCircle className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="font-semibold text-blue-900">API de WhatsApp - Wazzup24</h3>
          <p className="text-sm text-blue-700">
            Configura la integración con Wazzup24 para enviar notificaciones por WhatsApp
          </p>
        </div>
      </div>

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
        {/* API Key */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            API Key Wazzup24 *
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              required
              className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="aeaecead58f14a3286b37e4d0b81dc3a"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Obtén tu API Key desde el panel de Wazzup24
          </p>
        </div>

        {/* Número Remitente */}
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Número Remitente (WABA) *
          </label>
          <input
            type="text"
            value={formData.numero_remitente}
            onChange={(e) => setFormData({ ...formData, numero_remitente: e.target.value })}
            required
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="5215588545516"
          />
          <p className="text-xs text-neutral-600 mt-1">
            Número de WhatsApp Business con código de país (52 para México)
          </p>
        </div>

        {/* Estado */}
        <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
          <input
            type="checkbox"
            id="activo_whatsapp"
            checked={formData.activo}
            onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
          />
          <label htmlFor="activo_whatsapp" className="text-sm font-medium text-neutral-700 cursor-pointer">
            Activar sistema de envío por WhatsApp
          </label>
        </div>

        {/* Información Importante */}
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Información Importante
          </h4>
          <ul className="text-sm text-amber-800 space-y-1 ml-7">
            <li>• Los mensajes se enviarán al celular laboral de cada usuario</li>
            <li>• Los números se normalizan automáticamente: 52 + 10 dígitos (ejemplo: 525512345678)</li>
            <li>• Si el número tiene 10 dígitos, se agrega el prefijo 52 automáticamente</li>
            <li>• Si un usuario no tiene celular laboral, no recibirá WhatsApp</li>
            <li>• Wazzup24 cobra por mensaje enviado</li>
          </ul>
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
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
            Prueba de Envío por WhatsApp
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={testNumero}
              onChange={(e) => setTestNumero(e.target.value)}
              placeholder="5512345678 o 525512345678"
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={testing || !testNumero}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
            >
              <Send className="w-5 h-5" />
              {testing ? 'Enviando...' : 'Enviar Prueba'}
            </button>
          </div>
          <p className="text-sm text-neutral-600 mt-2">
            Ingresa 10 dígitos (5512345678) o formato completo (525512345678). El sistema normaliza automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
