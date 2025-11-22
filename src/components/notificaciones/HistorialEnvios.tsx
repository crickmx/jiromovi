import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
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
}

export function HistorialEnvios() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    fetchEnvios();
  }, [filtroEstado]);

  const fetchEnvios = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('correo_historial_envios')
        .select('*')
        .order('fecha_envio', { ascending: false })
        .limit(100);

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado);
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
      envio.asunto.toLowerCase().includes(searchLower)
    );
  });

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
            placeholder="Buscar por destinatario, tipo o asunto..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {enviosFiltrados.map((envio) => (
                <tr key={envio.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {format(new Date(envio.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {envio.destinatario_nombre || 'Sin nombre'}
                      </p>
                      <p className="text-xs text-neutral-600">{envio.destinatario_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded bg-neutral-100 text-xs text-neutral-700">
                      {envio.tipo_notificacion_codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-800">
                    {envio.asunto}
                  </td>
                  <td className="px-4 py-3">
                    {getEstadoBadge(envio.estado)}
                    {envio.error_mensaje && (
                      <p className="text-xs text-accent-600 mt-1">{envio.error_mensaje}</p>
                    )}
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
    </div>
  );
}
