import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Users, AlertCircle, FileText, Calendar, Clock } from 'lucide-react';

interface TicketEstatus {
  id: string;
  nombre: string;
  color: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
}

interface TicketData {
  id: string;
  folio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  agente: Usuario | null;
  estatus: TicketEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
}

interface Asignacion {
  ejecutivo: Usuario | null;
}

interface TicketDetallesProps {
  ticket: TicketData;
  editing: boolean;
  estatusList: TicketEstatus[];
  selectedEstatus: string;
  setSelectedEstatus: (value: string) => void;
  selectedPrioridad: 'Alta' | 'Media' | 'Baja';
  setSelectedPrioridad: (value: 'Alta' | 'Media' | 'Baja') => void;
}

export function TicketDetalles({
  ticket,
  editing,
  estatusList,
  selectedEstatus,
  setSelectedEstatus,
  selectedPrioridad,
  setSelectedPrioridad
}: TicketDetallesProps) {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);

  useEffect(() => {
    loadAsignaciones();
  }, [ticket.id]);

  const loadAsignaciones = async () => {
    const { data } = await supabase
      .from('ticket_asignaciones')
      .select('ejecutivo:ejecutivo_id(id, nombre_completo)')
      .eq('ticket_id', ticket.id);

    if (data) setAsignaciones(data as Asignacion[]);
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'bg-red-100 text-red-700 border-red-300';
      case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Baja': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Agente
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {ticket.agente?.nombre_completo || 'Sin agente asignado'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Prioridad
          </label>
          {editing ? (
            <select
              value={selectedPrioridad}
              onChange={(e) => setSelectedPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          ) : (
            <div className={`px-4 py-3 rounded-xl border font-semibold ${getPrioridadColor(ticket.prioridad)}`}>
              {ticket.prioridad}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Estatus
          </label>
          {editing ? (
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              {estatusList.map(estatus => (
                <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
              ))}
            </select>
          ) : (
            <div
              className="px-4 py-3 rounded-xl border font-semibold"
              style={{
                backgroundColor: ticket.estatus?.color + '20',
                color: ticket.estatus?.color,
                borderColor: ticket.estatus?.color
              }}
            >
              {ticket.estatus?.nombre}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Póliza
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {ticket.poliza || 'Sin póliza'}
          </div>
        </div>
      </div>

      {asignaciones.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <Users className="w-4 h-4 inline mr-2" />
            Ejecutivos Asignados
          </label>
          <div className="flex flex-wrap gap-2">
            {asignaciones.map((asignacion, index) => (
              <span
                key={index}
                className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg border border-primary-300 font-medium"
              >
                {asignacion.ejecutivo?.nombre_completo}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Instrucciones / Descripción
        </label>
        <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl whitespace-pre-wrap">
          {ticket.instrucciones}
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Información del Ticket</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Fecha de Creación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(ticket.fecha_creacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {ticket.creado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {ticket.creado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Última Modificación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(ticket.ultima_modificacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {ticket.modificado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {ticket.modificado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          {ticket.cerrado_en && (
            <div>
              <div className="flex items-center space-x-2 text-neutral-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Fecha de Cierre:</span>
              </div>
              <div className="text-neutral-900 ml-6">
                {new Date(ticket.cerrado_en).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              {ticket.cerrado_por_usuario && (
                <div className="text-neutral-600 ml-6 text-xs">
                  por {ticket.cerrado_por_usuario.nombre_completo}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
