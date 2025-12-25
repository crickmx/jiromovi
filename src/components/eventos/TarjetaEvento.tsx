import { Calendar, Clock, User, ExternalLink, Edit, Trash2, Eye } from 'lucide-react';
import { AulaEvento, formatearFechaEvento, formatearHoraEvento, esEventoFuturo, eventoPorComenzar } from '../../lib/aulaEventosUtils';

interface TarjetaEventoProps {
  evento: AulaEvento;
  isAdmin?: boolean;
  onIngresar?: (evento: AulaEvento) => void;
  onEditar?: (evento: AulaEvento) => void;
  onEliminar?: (evento: AulaEvento) => void;
  onVerDetalles?: (evento: AulaEvento) => void;
}

export function TarjetaEvento({
  evento,
  isAdmin = false,
  onIngresar,
  onEditar,
  onEliminar,
  onVerDetalles
}: TarjetaEventoProps) {
  const esFuturo = esEventoFuturo(evento.fecha, evento.hora);
  const porComenzar = eventoPorComenzar(evento.fecha, evento.hora);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-lg transition-all duration-300 overflow-hidden group">
      {/* Header con estado */}
      <div className={`px-6 py-3 ${esFuturo ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-neutral-400 to-neutral-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {esFuturo ? 'Próximo Evento' : 'Evento Pasado'}
            </span>
          </div>
          {porComenzar && (
            <span className="px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full animate-pulse">
              ¡Por comenzar!
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Título y Descripción */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-neutral-800 mb-2 group-hover:text-primary-600 transition">
            {evento.titulo}
          </h3>
          <p className="text-neutral-600 text-sm line-clamp-3">
            {evento.descripcion}
          </p>
        </div>

        {/* Información del evento */}
        <div className="space-y-2 mb-5">
          {/* Ponente */}
          <div className="flex items-center gap-2 text-neutral-700">
            <User className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span className="text-sm font-medium">{evento.ponente}</span>
          </div>

          {/* Fecha */}
          <div className="flex items-center gap-2 text-neutral-700">
            <Calendar className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span className="text-sm">
              {formatearFechaEvento(evento.fecha)}
            </span>
          </div>

          {/* Hora */}
          <div className="flex items-center gap-2 text-neutral-700">
            <Clock className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span className="text-sm font-medium">
              {formatearHoraEvento(evento.hora)}
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2">
          {/* Botón Ingresar (solo si es futuro o próximo) */}
          {esFuturo && onIngresar && (
            <button
              onClick={() => onIngresar(evento)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition ${
                porComenzar
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg'
                  : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}

          {/* Botón Ver Detalles */}
          {onVerDetalles && (
            <button
              onClick={() => onVerDetalles(evento)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-700 rounded-lg font-semibold hover:bg-neutral-200 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Ver Detalles</span>
            </button>
          )}

          {/* Botones de Admin */}
          {isAdmin && (
            <>
              {onEditar && (
                <button
                  onClick={() => onEditar(evento)}
                  className="px-4 py-2.5 bg-primary-50 text-primary-700 rounded-lg font-semibold hover:bg-primary-100 transition flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Editar</span>
                </button>
              )}
              {onEliminar && (
                <button
                  onClick={() => onEliminar(evento)}
                  className="px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 transition flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Badge de visibilidad (solo para admin) */}
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              evento.visible_para_todos
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {evento.visible_para_todos ? '🌍 Visible para todos' : '🔒 Permisos específicos'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
