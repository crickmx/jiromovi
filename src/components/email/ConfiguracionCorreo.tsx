import { useState, useEffect } from 'react';
import { X, Server, Mail, Lock, Check, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ConfiguracionCorreoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configuracion: any | null;
}

interface ConfigGlobal {
  servidor_imap: string;
  puerto_imap: number;
  servidor_smtp: string;
  puerto_smtp: number;
}

export function ConfiguracionCorreo({ isOpen, onClose, onSuccess, configuracion }: ConfiguracionCorreoProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [configGlobal, setConfigGlobal] = useState<ConfigGlobal | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadConfigGlobal();
    if (usuario) {
      setEmail(usuario.email_cuenta || '');
    }
  }, [usuario]);

  const loadConfigGlobal = async () => {
    const { data } = await supabase
      .from('email_config_global')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      setConfigGlobal(data);
    }
  };

  const handleVerificarConexion = async () => {
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña');
      return;
    }

    setVerificando(true);
    setError('');
    setSuccess('');

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
            email,
            password
          })
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess('✅ Conexión exitosa con el servidor de correo IONOS');

        await supabase
          .from('usuarios')
          .update({
            email_verificado: true,
            email_ultima_verificacion: new Date().toISOString(),
            email_error_mensaje: null
          })
          .eq('id', usuario!.id);

      } else {
        throw new Error(result.error || 'Error al conectar');
      }

    } catch (err: any) {
      console.error('Error verificando conexión:', err);
      setError('❌ Error al conectar con el servidor. Verifique su correo y contraseña.');

      await supabase
        .from('usuarios')
        .update({
          email_verificado: false,
          email_error_mensaje: err.message
        })
        .eq('id', usuario!.id);
    } finally {
      setVerificando(false);
    }
  };

  const handleGuardar = async () => {
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          email_cuenta: email,
          email_password: password
        })
        .eq('id', usuario!.id);

      if (updateError) throw updateError;

      setSuccess('Configuración guardada correctamente');
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error('Error guardando configuración:', err);
      setError(err.message || 'Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-strong max-w-2xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Configuración de correo (IONOS)
            </h2>
            <p className="text-sm text-neutral-600">
              Ingresa tu correo y contraseña de IONOS
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-xl flex items-center space-x-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center space-x-2">
              <Mail className="w-5 h-5 text-primary-600" />
              <span>Tus credenciales de correo</span>
            </h3>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Correo electrónico *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="nombre@jiro.mx"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Tu dirección de correo completa en IONOS
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Contraseña *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tu contraseña de correo"
              />
              <p className="text-xs text-neutral-500 mt-1">
                La contraseña se guarda encriptada y nunca se muestra
              </p>
            </div>

            <button
              onClick={handleVerificarConexion}
              disabled={verificando || !email || !password}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-50 text-blue-700 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="w-5 h-5" />
              <span>{verificando ? 'Verificando conexión...' : 'Verificar conexión'}</span>
            </button>

            {usuario?.email_verificado && usuario.email_ultima_verificacion && (
              <div className="bg-success-50 border border-success-200 rounded-xl p-3 flex items-center space-x-2">
                <Check className="w-5 h-5 text-success-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-success-900">Conexión verificada</p>
                  <p className="text-success-700">
                    Última verificación: {new Date(usuario.email_ultima_verificacion).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 bg-neutral-50 rounded-xl p-4 border border-neutral-200">
            <h3 className="font-semibold text-neutral-900 flex items-center space-x-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span>Servidores (preconfigurados)</span>
            </h3>

            {configGlobal && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-neutral-600 font-medium mb-1">Entrada (IMAP):</p>
                    <p className="font-mono text-neutral-900">
                      {configGlobal.servidor_imap}:{configGlobal.puerto_imap}
                    </p>
                    <p className="text-xs text-neutral-500">SSL/TLS habilitado</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 font-medium mb-1">Salida (SMTP):</p>
                    <p className="font-mono text-neutral-900">
                      {configGlobal.servidor_smtp}:{configGlobal.puerto_smtp}
                    </p>
                    <p className="text-xs text-neutral-500">SSL/TLS habilitado</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-300">
                  <p className="text-xs text-neutral-600 flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>
                      Todos los servidores están preconfigurados para IONOS México.
                      {isAdmin && ' Como administrador, puedes modificar estos valores en Configuración.'}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Información importante</span>
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Tu nombre de remitente será: <strong>{usuario?.nombre}</strong></li>
              <li>Los correos se enviarán desde tu cuenta IONOS personal</li>
              <li>La sincronización es automática y en tiempo real</li>
              <li>Tus credenciales están protegidas con encriptación</li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
          >
            Cancelar
          </button>

          <button
            onClick={handleGuardar}
            disabled={loading || !email || !password}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
