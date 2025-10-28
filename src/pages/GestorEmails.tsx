import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail, Send, FileText, Trash2, AlertCircle, Inbox, Search, RefreshCw,
  Star, Paperclip, ChevronLeft, ChevronRight, Settings, Plus, Calendar, Filter
} from 'lucide-react';
import { ConfiguracionCorreo } from '../components/email/ConfiguracionCorreo';
import { RedactarCorreo } from '../components/email/RedactarCorreo';
import { BuscadorAvanzado } from '../components/email/BuscadorAvanzado';

interface EmailConfig {
  id: string;
  email: string;
  nombre_remitente: string | null;
  servidor_entrada: string;
  servidor_salida: string;
  ultima_sincronizacion: string | null;
  estado_conexion: string;
}

interface EmailMessage {
  id: string;
  message_uid: string;
  carpeta: string;
  remitente: string;
  remitente_email: string;
  asunto: string | null;
  cuerpo_html: string | null;
  cuerpo_texto: string | null;
  fecha: string;
  leido: boolean;
  marcado: boolean;
  tiene_adjuntos: boolean;
  destinatarios: string[];
  cc: string[];
}

type Carpeta = 'INBOX' | 'SENT' | 'DRAFTS' | 'TRASH' | 'SPAM' | 'QUEUE';

const CARPETAS_INFO = {
  INBOX: { nombre: 'Bandeja de entrada', icon: Inbox, color: 'text-blue-600' },
  SENT: { nombre: 'Enviados', icon: Send, color: 'text-green-600' },
  DRAFTS: { nombre: 'Borradores', icon: FileText, color: 'text-yellow-600' },
  QUEUE: { nombre: 'En cola', icon: Calendar, color: 'text-purple-600' },
  TRASH: { nombre: 'Papelera', icon: Trash2, color: 'text-red-600' },
  SPAM: { nombre: 'Spam', icon: AlertCircle, color: 'text-orange-600' }
};

export function GestorEmails() {
  const { usuario } = useAuth();
  const [configuracion, setConfiguracion] = useState<EmailConfig | null>(null);
  const [carpetaActual, setCarpetaActual] = useState<Carpeta>('INBOX');
  const [mensajes, setMensajes] = useState<EmailMessage[]>([]);
  const [mensajeSeleccionado, setMensajeSeleccionado] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);

  // Modales
  const [showConfig, setShowConfig] = useState(false);
  const [showRedactar, setShowRedactar] = useState(false);
  const [showBuscador, setShowBuscador] = useState(false);

  useEffect(() => {
    loadConfiguracion();
  }, [usuario]);

  useEffect(() => {
    if (configuracion) {
      loadMensajes();
    }
  }, [configuracion, carpetaActual]);

  const loadConfiguracion = async () => {
    if (!usuario) return;

    const { data, error } = await supabase
      .from('email_configuraciones')
      .select('*')
      .eq('usuario_id', usuario.id)
      .maybeSingle();

    if (error) {
      console.error('Error cargando configuración:', error);
    }

    setConfiguracion(data);

    if (!data) {
      setShowConfig(true);
    }

    setLoading(false);
  };

  const loadMensajes = async () => {
    if (!configuracion) return;

    const { data, error } = await supabase
      .from('email_mensajes_cache')
      .select('*')
      .eq('usuario_id', usuario!.id)
      .eq('carpeta', carpetaActual)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error cargando mensajes:', error);
    } else {
      setMensajes(data || []);
    }
  };

  const handleSincronizar = async () => {
    if (!configuracion) return;

    setSincronizando(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-inbox`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            configuracionId: configuracion.id,
            carpeta: carpetaActual
          })
        }
      );

      if (response.ok) {
        await loadMensajes();
        await loadConfiguracion();
      }
    } catch (error) {
      console.error('Error sincronizando:', error);
    } finally {
      setSincronizando(false);
    }
  };

  const handleMarcarLeido = async (mensaje: EmailMessage) => {
    await supabase
      .from('email_mensajes_cache')
      .update({ leido: !mensaje.leido })
      .eq('id', mensaje.id);

    await loadMensajes();
  };

  const handleMarcarEstrella = async (mensaje: EmailMessage) => {
    await supabase
      .from('email_mensajes_cache')
      .update({ marcado: !mensaje.marcado })
      .eq('id', mensaje.id);

    await loadMensajes();
  };

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (date.toDateString() === hoy.toDateString()) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Mail className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-display font-bold text-neutral-900">
                Gestor de E-Mails
              </h1>
              {configuracion && (
                <p className="text-sm text-neutral-600">
                  {configuracion.email}
                  {configuracion.ultima_sincronizacion && (
                    <span className="ml-2">
                      · Actualizado {formatFecha(configuracion.ultima_sincronizacion)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowBuscador(true)}
              className="flex items-center space-x-2 px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all"
              title="Buscador avanzado"
            >
              <Search className="w-5 h-5" />
              <span className="hidden sm:inline">Buscar</span>
            </button>

            <button
              onClick={handleSincronizar}
              disabled={sincronizando || !configuracion}
              className="flex items-center space-x-2 px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${sincronizando ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {sincronizando ? 'Actualizando...' : 'Actualizar'}
              </span>
            </button>

            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center space-x-2 px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all"
              title="Configuración"
            >
              <Settings className="w-5 h-5" />
            </button>

            {configuracion && (
              <button
                onClick={() => setShowRedactar(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-lg hover:shadow-medium transition-all"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Redactar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      {!configuracion ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <Mail className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">
              Configura tu cuenta de correo
            </h2>
            <p className="text-neutral-600 mb-6">
              Para comenzar a usar el gestor de e-mails, primero debes configurar tu cuenta de correo.
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl hover:shadow-medium transition-all font-semibold"
            >
              Configurar ahora
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Carpetas */}
          <div className="w-64 bg-white border-r border-neutral-200 overflow-y-auto">
            <div className="p-4 space-y-1">
              {Object.entries(CARPETAS_INFO).map(([key, info]) => {
                const Icon = info.icon;
                const count = mensajes.filter(m => m.carpeta === key).length;
                const isActive = carpetaActual === key;

                return (
                  <button
                    key={key}
                    onClick={() => setCarpetaActual(key as Carpeta)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : info.color}`} />
                      <span>{info.nombre}</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="w-96 bg-white border-r border-neutral-200 overflow-y-auto">
            <div className="p-4 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">
                {CARPETAS_INFO[carpetaActual].nombre}
              </h2>
              <p className="text-sm text-neutral-600">
                {mensajes.length} {mensajes.length === 1 ? 'mensaje' : 'mensajes'}
              </p>
            </div>

            {mensajes.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500">No hay mensajes</p>
              </div>
            ) : (
              <div>
                {mensajes.map((mensaje) => (
                  <div
                    key={mensaje.id}
                    onClick={() => {
                      setMensajeSeleccionado(mensaje);
                      if (!mensaje.leido) handleMarcarLeido(mensaje);
                    }}
                    className={`p-4 border-b border-neutral-200 cursor-pointer transition-all ${
                      !mensaje.leido ? 'bg-blue-50' : 'hover:bg-neutral-50'
                    } ${
                      mensajeSeleccionado?.id === mensaje.id
                        ? 'bg-primary-50 border-l-4 border-l-primary-600'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarcarEstrella(mensaje);
                            }}
                            className="flex-shrink-0"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                mensaje.marcado
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-neutral-400 hover:text-yellow-400'
                              }`}
                            />
                          </button>
                          <p className={`text-sm truncate ${
                            !mensaje.leido ? 'font-bold text-neutral-900' : 'text-neutral-700'
                          }`}>
                            {mensaje.remitente}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">
                        {formatFecha(mensaje.fecha)}
                      </span>
                    </div>
                    <p className={`text-sm mb-1 truncate ${
                      !mensaje.leido ? 'font-semibold text-neutral-900' : 'text-neutral-600'
                    }`}>
                      {mensaje.asunto || '(Sin asunto)'}
                    </p>
                    <div className="flex items-center space-x-2">
                      {mensaje.tiene_adjuntos && (
                        <Paperclip className="w-3 h-3 text-neutral-400" />
                      )}
                      <p className="text-xs text-neutral-500 truncate">
                        {mensaje.cuerpo_texto?.substring(0, 50)}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panel de lectura */}
          <div className="flex-1 bg-white overflow-y-auto">
            {mensajeSeleccionado ? (
              <div className="h-full flex flex-col">
                <div className="p-6 border-b border-neutral-200">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-2xl font-bold text-neutral-900">
                      {mensajeSeleccionado.asunto || '(Sin asunto)'}
                    </h2>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div>
                      <span className="font-semibold text-neutral-900">
                        {mensajeSeleccionado.remitente}
                      </span>
                      <span className="text-neutral-600 ml-2">
                        {`<${mensajeSeleccionado.remitente_email}>`}
                      </span>
                    </div>
                    <span className="text-neutral-500">
                      {new Date(mensajeSeleccionado.fecha).toLocaleString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {mensajeSeleccionado.destinatarios.length > 0 && (
                    <div className="mt-2 text-sm text-neutral-600">
                      <span className="font-semibold">Para:</span> {mensajeSeleccionado.destinatarios.join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                  {mensajeSeleccionado.cuerpo_html ? (
                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: mensajeSeleccionado.cuerpo_html }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-neutral-700">
                      {mensajeSeleccionado.cuerpo_texto}
                    </p>
                  )}
                </div>

                <div className="p-4 border-t border-neutral-200 flex space-x-2">
                  <button
                    onClick={() => {
                      setShowRedactar(true);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all"
                  >
                    Responder
                  </button>
                  <button className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-all">
                    Responder a todos
                  </button>
                  <button className="px-4 py-2 text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-all">
                    Reenviar
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto mb-4" />
                  <p>Selecciona un mensaje para leerlo</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {showConfig && (
        <ConfiguracionCorreo
          isOpen={showConfig}
          onClose={() => setShowConfig(false)}
          onSuccess={() => {
            setShowConfig(false);
            loadConfiguracion();
          }}
          configuracion={configuracion}
        />
      )}

      {showRedactar && configuracion && (
        <RedactarCorreo
          isOpen={showRedactar}
          onClose={() => setShowRedactar(false)}
          onSuccess={() => {
            setShowRedactar(false);
            loadMensajes();
          }}
          configuracion={configuracion}
        />
      )}

      {showBuscador && (
        <BuscadorAvanzado
          isOpen={showBuscador}
          onClose={() => setShowBuscador(false)}
          onSearch={(resultados) => {
            setMensajes(resultados);
            setShowBuscador(false);
          }}
        />
      )}
    </div>
  );
}
