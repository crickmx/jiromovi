import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, CheckCircle2, XCircle, Clock, Search, MessageCircle, Bell, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Envio {
  id: string;
  tipo_notificacion_codigo: string;
  destinatario_email: string;
  destinatario_nombre: string | null;
  asunto: string;
  estado: 'pendiente' | 'enviado' | 'fallido';
  error_mensaje: string | null;
  fecha_envio: string;
  canal_envio: 'correo' | 'whatsapp' | 'notificacion' | null;
  numero_destino: string | null;
  cuerpo_html: string | null;
  usuario_id: string | null;
  enviado_por: string | null;
}

export function HistorialEnvios() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroCanal, setFiltroCanal] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [envioSeleccionado, setEnvioSeleccionado] = useState<Envio | null>(null);

  useEffect(() => {
    fetchEnvios();
  }, [filtroEstado, filtroCanal]);

  const fetchEnvios = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('correo_historial_envios')
        .select('*')
        .order('fecha_envio', { ascending: false })
        .limit(200);

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado);
      }

      if (filtroCanal !== 'todos') {
        query = query.eq('canal_envio', filtroCanal);
      }

      const { data, error } = await query;
      if (error) throw error;

      setEnvios(data || []);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const enviosFiltrados = envios.filter((envio) => {
    if (!busqueda) return true;
    const searchLower = busqueda.toLowerCase();
    return (
      envio.destinatario_email.toLowerCase().includes(searchLower) ||
      envio.destinatario_nombre?.toLowerCase().includes(searchLower) ||
      envio.tipo_notificacion_codigo.toLowerCase().includes(searchLower) ||
      envio.asunto.toLowerCase().includes(searchLower) ||
      envio.numero_destino?.toLowerCase().includes(searchLower)
    );
  });

  const getCanalIcon = (canal: string | null) => {
    switch (canal) {
      case 'correo':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />;
      case 'notificacion':
        return <Bell className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  const getCanalBadge = (canal: string | null) => {
    switch (canal) {
      case 'correo':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Mail className="w-3 h-3" />
            Correo
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </span>
        );
      case 'notificacion':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Bell className="w-3 h-3" />
            Notificación
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
            <Mail className="w-3 h-3" />
            Sin canal
          </span>
        );
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'enviado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" />
            Enviado
          </span>
        );
      case 'fallido':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
            <XCircle className="w-3 h-3" />
            Fallido
          </span>
        );
      case 'pendiente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por destinatario, teléfono, tipo o asunto..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
          />
        </div>

        <select
          value={filtroCanal}
          onChange={(e) => setFiltroCanal(e.target.value)}
          className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
        >
          <option value="todos">Todos los canales</option>
          <option value="correo">Correo</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="notificacion">Notificación</option>
        </select>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
        >
          <option value="todos">Todos los estados</option>
          <option value="enviado">Enviados</option>
          <option value="fallido">Fallidos</option>
          <option value="pendiente">Pendientes</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Canal
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Destinatario
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Asunto
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {enviosFiltrados.map((envio) => (
                <tr key={envio.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {envio.fecha_envio
                      ? format(new Date(envio.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })
                      : 'Sin fecha'
                    }
                  </td>
                  <td className="px-4 py-3">
                    {getCanalBadge(envio.canal_envio)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {envio.destinatario_nombre || 'Sin nombre'}
                      </p>
                      {envio.canal_envio === 'whatsapp' && envio.numero_destino ? (
                        <p className="text-xs text-neutral-600">{envio.numero_destino}</p>
                      ) : (
                        <p className="text-xs text-neutral-600">{envio.destinatario_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded bg-neutral-100 text-xs text-neutral-700">
                      {envio.tipo_notificacion_codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-800 max-w-xs truncate">
                    {envio.asunto}
                  </td>
                  <td className="px-4 py-3">
                    {getEstadoBadge(envio.estado)}
                    {envio.error_mensaje && (
                      <p className="text-xs text-accent-600 mt-1 max-w-xs truncate" title={envio.error_mensaje}>
                        {envio.error_mensaje}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEnvioSeleccionado(envio)}
                      className="p-2 text-neutral-600 hover:text-accent hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {enviosFiltrados.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron envíos</p>
          </div>
        )}
      </div>

      <div className="text-sm text-neutral-600 text-center">
        Mostrando {enviosFiltrados.length} de {envios.length} registros
      </div>

      {/* Modal de Detalles */}
      {envioSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                {getCanalIcon(envioSeleccionado.canal_envio)}
                <h3 className="text-xl font-bold text-neutral-800">Detalles del Envío</h3>
              </div>
              <button
                onClick={() => setEnvioSeleccionado(null)}
                className="p-2 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Información General */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Información General</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">ID de Envío</p>
                    <p className="text-sm font-mono text-neutral-800 break-all">{envioSeleccionado.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Fecha de Envío</p>
                    <p className="text-sm text-neutral-800">
                      {envioSeleccionado.fecha_envio
                        ? format(new Date(envioSeleccionado.fecha_envio), "dd 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })
                        : 'Sin fecha'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Canal de Envío</p>
                    <div className="mt-1">{getCanalBadge(envioSeleccionado.canal_envio)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Estado</p>
                    <div className="mt-1">{getEstadoBadge(envioSeleccionado.estado)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Tipo de Notificación</p>
                    <p className="text-sm font-medium text-neutral-800">{envioSeleccionado.tipo_notificacion_codigo}</p>
                  </div>
                </div>
              </div>

              {/* Destinatario */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Destinatario</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Nombre</p>
                    <p className="text-sm text-neutral-800">{envioSeleccionado.destinatario_nombre || 'Sin nombre'}</p>
                  </div>
                  {envioSeleccionado.canal_envio === 'whatsapp' && envioSeleccionado.numero_destino ? (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Número de Teléfono</p>
                      <p className="text-sm font-mono text-neutral-800">{envioSeleccionado.numero_destino}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Email</p>
                      <p className="text-sm font-mono text-neutral-800">{envioSeleccionado.destinatario_email}</p>
                    </div>
                  )}
                  {envioSeleccionado.usuario_id && (
                    <div>
                      <p className="text-xs text-neutral-600 mb-1">Usuario ID</p>
                      <p className="text-sm font-mono text-neutral-800 break-all">{envioSeleccionado.usuario_id}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contenido */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Contenido</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">Asunto</p>
                    <p className="text-sm text-neutral-800">{envioSeleccionado.asunto}</p>
                  </div>
                  {envioSeleccionado.cuerpo_html && envioSeleccionado.canal_envio === 'correo' && (
                    <div>
                      <p className="text-xs text-neutral-600 mb-2">Vista Previa del HTML</p>
                      <div
                        className="border border-neutral-200 rounded-lg p-4 bg-neutral-50 max-h-96 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: envioSeleccionado.cuerpo_html }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Error */}
              {envioSeleccionado.error_mensaje && (
                <div>
                  <h4 className="text-sm font-semibold text-accent-700 mb-3">Mensaje de Error</h4>
                  <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
                    <p className="text-sm text-accent-800">{envioSeleccionado.error_mensaje}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setEnvioSeleccionado(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
