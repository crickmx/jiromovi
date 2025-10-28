import { useState } from 'react';
import { Mail, Lock, Check, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CorreoIONOSFieldsProps {
  emailCuenta: string | null;
  emailPassword: string | null;
  emailVerificado: boolean | null;
  emailUltimaVerificacion: string | null;
  emailErrorMensaje: string | null;
  onChange: (field: string, value: any) => void;
  editable: boolean;
  usuarioId: string;
}

export function CorreoIONOSFields({
  emailCuenta,
  emailPassword,
  emailVerificado,
  emailUltimaVerificacion,
  emailErrorMensaje,
  onChange,
  editable,
  usuarioId
}: CorreoIONOSFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleVerificarConexion = async () => {
    if (!emailCuenta || !emailPassword) {
      setMessage({ type: 'error', text: 'Por favor ingresa correo y contraseña' });
      return;
    }

    setVerificando(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-verify-connection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: emailCuenta,
            password: emailPassword
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: '✅ Conexión exitosa con el servidor de correo IONOS' });

        await supabase
          .from('usuarios')
          .update({
            email_verificado: true,
            email_ultima_verificacion: new Date().toISOString(),
            email_error_mensaje: null
          })
          .eq('id', usuarioId);

        onChange('email_verificado', true);
        onChange('email_ultima_verificacion', new Date().toISOString());
        onChange('email_error_mensaje', null);

      } else {
        throw new Error(result.error || 'Error al conectar');
      }

    } catch (err: any) {
      console.error('Error verificando conexión:', err);
      setMessage({ type: 'error', text: '❌ Error al conectar con el servidor. Verifique su correo y contraseña.' });

      await supabase
        .from('usuarios')
        .update({
          email_verificado: false,
          email_error_mensaje: err.message
        })
        .eq('id', usuarioId);

      onChange('email_verificado', false);
      onChange('email_error_mensaje', err.message);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-neutral-50 rounded-xl border-2 border-blue-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Mail className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-neutral-900 text-lg">Configuración de correo (IONOS)</h3>
          <p className="text-sm text-neutral-600">
            Ingresa tu correo y contraseña para acceder al Gestor de E-Mails
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-success-50 text-success-700 border border-success-200'
              : 'bg-accent-50 text-accent-700 border border-accent-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Correo electrónico
          </label>
          <input
            type="email"
            value={emailCuenta || ''}
            onChange={(e) => onChange('email_cuenta', e.target.value)}
            disabled={!editable}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
            placeholder="nombre@jiro.mx"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Tu dirección de correo completa en IONOS
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={emailPassword || ''}
              onChange={(e) => onChange('email_password', e.target.value)}
              disabled={!editable}
              className="w-full px-4 py-2.5 pr-10 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100 disabled:text-neutral-500"
              placeholder="Tu contraseña de correo"
            />
            {emailPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Se guarda encriptada
          </p>
        </div>
      </div>

      {editable && emailCuenta && emailPassword && (
        <div className="mb-4">
          <button
            onClick={handleVerificarConexion}
            disabled={verificando}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield className="w-5 h-5" />
            <span>{verificando ? 'Verificando conexión...' : 'Verificar conexión'}</span>
          </button>
        </div>
      )}

      {emailVerificado && emailUltimaVerificacion && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-3 flex items-center space-x-2">
          <Check className="w-5 h-5 text-success-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-success-900">Conexión verificada</p>
            <p className="text-success-700">
              Última verificación: {new Date(emailUltimaVerificacion).toLocaleString('es-MX')}
            </p>
          </div>
        </div>
      )}

      {emailErrorMensaje && !emailVerificado && (
        <div className="bg-accent-50 border border-accent-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-accent-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-accent-900">Error de conexión</p>
            <p className="text-accent-700">{emailErrorMensaje}</p>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-blue-200">
        <p className="text-xs text-neutral-600 flex items-start space-x-2">
          <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Servidores preconfigurados: <strong>imap.ionos.mx:993</strong> (entrada) y <strong>smtp.ionos.mx:465</strong> (salida).
            Tus credenciales están protegidas con encriptación.
          </span>
        </p>
      </div>
    </div>
  );
}
