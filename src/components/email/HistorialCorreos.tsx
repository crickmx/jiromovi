import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, CheckCircle, XCircle, Clock, Eye, X, Calendar } from 'lucide-react';

interface HistorialEmail {
  id: string;
  destinatario_email: string;
  asunto: string;
  cuerpo_html: string;
  tipo_envio: 'manual' | 'automatico';
  estado: 'enviado' | 'fallido' | 'pendiente';
  error_mensaje: string | null;
  fecha_envio: string;
  plantilla: {
    nombre: string;
    tipo: string;
  } | null;
  destinatario: {
    nombre: string;
    apellidos: string;
  } | null;
  enviado_por: {
    nombre: string;
    apellidos: string;
  } | null;
}

export function HistorialCorreos() {
  const [historial, setHistorial] = useState<HistorialEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<HistorialEmail | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadHistorial();
  }, [page, filtroEstado, filtroTipo]);

  const loadHistorial = async () => {
    setLoading(true);

    let query = supabase
      .from('historial_correos')
      .select(
        `
        *,
        plantilla:plantillas_correo(nombre, tipo),
        destinatario:usuarios!historial_correos_destinatario_id_fkey(nombre, apellidos),
        enviado_por:usuarios!historial_correos_enviado_por_id_fkey(nombre, apellidos)
      `
      )
      .order('fecha_envio', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filtroEstado !== 'todos') {
      query = query.eq('estado', filtroEstado);
    }

    if (filtroTipo !== 'todos') {
      query = query.eq('tipo_envio', filtroTipo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading email history:', error);
    } else {
      setHistorial(data || []);
    }

    setLoading(false);
  };

  const handleViewEmail = (email: HistorialEmail) => {
    setSelectedEmail(email);
    setShowPreview(true);
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'enviado':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'fallido':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pendiente':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getEstadoBadge = (estado: string) => {
    const styles = {
      enviado: 'bg-green-100 text-green-700',
      fallido: 'bg-red-100 text-red-700',
      pendiente: 'bg-yellow-100 text-yellow-700',
    };

    const labels = {
      enviado: 'Enviado',
      fallido: 'Fallido',
      pendiente: 'Pendiente',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[estado as keyof typeof styles]}`}>
        {labels[estado as keyof typeof labels]}
      </span>
    );
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === 'manual' ? (
      <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">Manual</span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">Automático</span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && page === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => {
              setFiltroEstado(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="enviado">Enviado</option>
            <option value="fallido">Fallido</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de envío</label>
          <select
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="manual">Manual</option>
            <option value="automatico">Automático</option>
          </select>
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">Página {page + 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={historial.length < pageSize}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>

      {historial.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Mail className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No hay correos en el historial</p>
        </div>
      ) : (
        <div className="space-y-4">
          {historial.map((email) => (
            <div key={email.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getEstadoIcon(email.estado)}
                    <h3 className="text-base font-semibold text-slate-900">{email.asunto}</h3>
                    {getEstadoBadge(email.estado)}
                    {getTipoBadge(email.tipo_envio)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-slate-600">
                    <div>
                      <strong>Destinatario:</strong> {email.destinatario_email}
                      {email.destinatario && (
                        <span className="text-slate-500">
                          {' '}
                          ({email.destinatario.nombre} {email.destinatario.apellidos})
                        </span>
                      )}
                    </div>

                    {email.plantilla && (
                      <div>
                        <strong>Plantilla:</strong> {email.plantilla.nombre}
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(email.fecha_envio)}</span>
                    </div>

                    {email.enviado_por && (
                      <div>
                        <strong>Enviado por:</strong> {email.enviado_por.nombre} {email.enviado_por.apellidos}
                      </div>
                    )}

                    {email.estado === 'fallido' && email.error_mensaje && (
                      <div className="col-span-full text-red-600">
                        <strong>Error:</strong> {email.error_mensaje}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleViewEmail(email)}
                  className="ml-4 p-2 text-accent hover:bg-primary-50 rounded-lg transition"
                  title="Ver contenido"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showPreview && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Contenido del correo</h2>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 space-y-2">
                <div className="flex items-center space-x-2">
                  {getEstadoIcon(selectedEmail.estado)}
                  {getEstadoBadge(selectedEmail.estado)}
                  {getTipoBadge(selectedEmail.tipo_envio)}
                </div>

                <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
                  <p>
                    <strong>Para:</strong> {selectedEmail.destinatario_email}
                  </p>
                  <p>
                    <strong>Asunto:</strong> {selectedEmail.asunto}
                  </p>
                  <p>
                    <strong>Fecha:</strong> {formatDate(selectedEmail.fecha_envio)}
                  </p>
                  {selectedEmail.plantilla && (
                    <p>
                      <strong>Plantilla:</strong> {selectedEmail.plantilla.nombre}
                    </p>
                  )}
                  {selectedEmail.enviado_por && (
                    <p>
                      <strong>Enviado por:</strong> {selectedEmail.enviado_por.nombre}{' '}
                      {selectedEmail.enviado_por.apellidos}
                    </p>
                  )}
                  {selectedEmail.estado === 'fallido' && selectedEmail.error_mensaje && (
                    <p className="text-red-600">
                      <strong>Error:</strong> {selectedEmail.error_mensaje}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <h3 className="font-semibold text-slate-900 mb-2">Contenido HTML:</h3>
              </div>

              <div
                className="border border-slate-200 rounded-lg p-6 bg-white"
                dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo_html }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
