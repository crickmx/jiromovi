import { useState, useEffect } from 'react';
import { X, Server, Mail, Lock, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ConfiguracionCorreoProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configuracion: any | null;
}

export function ConfiguracionCorreo({ isOpen, onClose, onSuccess, configuracion }: ConfiguracionCorreoProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Campos del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreRemitente, setNombreRemitente] = useState('');

  const [servidorEntrada, setServidorEntrada] = useState('');
  const [puertoEntrada, setPuertoEntrada] = useState(993);
  const [tipoEntrada, setTipoEntrada] = useState<'IMAP' | 'POP3'>('IMAP');
  const [sslEntrada, setSslEntrada] = useState(true);

  const [servidorSalida, setServidorSalida] = useState('');
  const [puertoSalida, setPuertoSalida] = useState(587);
  const [sslSalida, setSslSalida] = useState(true);

  useEffect(() => {
    if (configuracion) {
      setEmail(configuracion.email || '');
      setNombreRemitente(configuracion.nombre_remitente || '');
      setServidorEntrada(configuracion.servidor_entrada || '');
      setPuertoEntrada(configuracion.puerto_entrada || 993);
      setTipoEntrada(configuracion.tipo_entrada || 'IMAP');
      setSslEntrada(configuracion.ssl_entrada ?? true);
      setServidorSalida(configuracion.servidor_salida || '');
      setPuertoSalida(configuracion.puerto_salida || 587);
      setSslSalida(configuracion.ssl_salida ?? true);
    } else if (usuario) {
      setNombreRemitente(usuario.nombre_completo || '');
    }
  }, [configuracion, usuario]);

  const handleGuardar = async () => {
    if (!email || !servidorEntrada || !servidorSalida) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const datos = {
        usuario_id: usuario!.id,
        email,
        password_encrypted: password || configuracion?.password_encrypted,
        nombre_remitente: nombreRemitente || usuario!.nombre_completo,
        servidor_entrada: servidorEntrada,
        puerto_entrada: puertoEntrada,
        tipo_entrada: tipoEntrada,
        ssl_entrada: sslEntrada,
        servidor_salida: servidorSalida,
        puerto_salida: puertoSalida,
        ssl_salida: sslSalida,
        activa: true,
        estado_conexion: 'sin_verificar',
        updated_at: new Date().toISOString()
      };

      if (configuracion) {
        const { error: updateError } = await supabase
          .from('email_configuraciones')
          .update(datos)
          .eq('id', configuracion.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('email_configuraciones')
          .insert(datos);

        if (insertError) throw insertError;
      }

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

  const handleAutoConfig = (proveedor: 'gmail' | 'outlook' | 'yahoo') => {
    const configs = {
      gmail: {
        servidorEntrada: 'imap.gmail.com',
        puertoEntrada: 993,
        servidorSalida: 'smtp.gmail.com',
        puertoSalida: 587,
        ssl: true
      },
      outlook: {
        servidorEntrada: 'outlook.office365.com',
        puertoEntrada: 993,
        servidorSalida: 'smtp.office365.com',
        puertoSalida: 587,
        ssl: true
      },
      yahoo: {
        servidorEntrada: 'imap.mail.yahoo.com',
        puertoEntrada: 993,
        servidorSalida: 'smtp.mail.yahoo.com',
        puertoSalida: 587,
        ssl: true
      }
    };

    const config = configs[proveedor];
    setServidorEntrada(config.servidorEntrada);
    setPuertoEntrada(config.puertoEntrada);
    setServidorSalida(config.servidorSalida);
    setPuertoSalida(config.puertoSalida);
    setSslEntrada(config.ssl);
    setSslSalida(config.ssl);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-strong max-w-3xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Configuración de correo
            </h2>
            <p className="text-sm text-neutral-600">
              Configura tu cuenta de correo electrónico
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

          {/* Configuración rápida */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-3">
              Configuración rápida
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleAutoConfig('gmail')}
                className="p-4 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
              >
                <div className="font-semibold text-neutral-900">Gmail</div>
                <div className="text-xs text-neutral-600">Google</div>
              </button>
              <button
                onClick={() => handleAutoConfig('outlook')}
                className="p-4 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
              >
                <div className="font-semibold text-neutral-900">Outlook</div>
                <div className="text-xs text-neutral-600">Microsoft</div>
              </button>
              <button
                onClick={() => handleAutoConfig('yahoo')}
                className="p-4 border-2 border-neutral-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center"
              >
                <div className="font-semibold text-neutral-900">Yahoo</div>
                <div className="text-xs text-neutral-600">Yahoo Mail</div>
              </button>
            </div>
          </div>

          {/* Datos de la cuenta */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center space-x-2">
              <Mail className="w-5 h-5 text-primary-600" />
              <span>Datos de la cuenta</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="tu@correo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Contraseña {!configuracion && '*'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={configuracion ? '(No cambiar)' : 'Contraseña'}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Nombre del remitente
                </label>
                <input
                  type="text"
                  value={nombreRemitente}
                  onChange={(e) => setNombreRemitente(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Tu nombre"
                />
              </div>
            </div>
          </div>

          {/* Servidor de entrada */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center space-x-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span>Servidor de entrada ({tipoEntrada})</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Servidor *
                </label>
                <input
                  type="text"
                  value={servidorEntrada}
                  onChange={(e) => setServidorEntrada(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="imap.example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Tipo
                </label>
                <select
                  value={tipoEntrada}
                  onChange={(e) => setTipoEntrada(e.target.value as 'IMAP' | 'POP3')}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="IMAP">IMAP</option>
                  <option value="POP3">POP3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Puerto
                </label>
                <input
                  type="number"
                  value={puertoEntrada}
                  onChange={(e) => setPuertoEntrada(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sslEntrada}
                    onChange={(e) => setSslEntrada(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">Usar SSL/TLS</span>
                </label>
              </div>
            </div>
          </div>

          {/* Servidor de salida */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center space-x-2">
              <Server className="w-5 h-5 text-green-600" />
              <span>Servidor de salida (SMTP)</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Servidor *
                </label>
                <input
                  type="text"
                  value={servidorSalida}
                  onChange={(e) => setServidorSalida(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="smtp.example.com"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Puerto
                </label>
                <input
                  type="number"
                  value={puertoSalida}
                  onChange={(e) => setPuertoSalida(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sslSalida}
                    onChange={(e) => setSslSalida(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700">Usar SSL/TLS</span>
                </label>
              </div>
            </div>
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
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all font-semibold disabled:opacity-50"
          >
            {loading ? 'Guardando...' : configuracion ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
