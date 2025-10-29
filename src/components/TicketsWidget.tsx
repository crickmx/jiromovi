import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ticket, Plus, AlertCircle } from 'lucide-react';

interface TicketItem {
  id: string;
  folio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  instrucciones: string;
  estatus: {
    nombre: string;
    color: string;
  } | null;
}

export function TicketsWidget() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('tickets')
      .select(`
        id,
        folio,
        prioridad,
        instrucciones,
        estatus:estatus_id(nombre, color)
      `)
      .is('cerrado_en', null)
      .or(`agente_id.eq.${usuario.id},creado_por.eq.${usuario.id}`)
      .order('fecha_creacion', { ascending: false })
      .limit(5);

    if (data) setTickets(data as TicketItem[]);
    setLoading(false);
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'text-red-600';
      case 'Media': return 'text-yellow-600';
      case 'Baja': return 'text-green-600';
      default: return 'text-neutral-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Ticket className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-display font-bold text-neutral-900">
            Mis Tickets Activos
          </h2>
        </div>
        <button
          onClick={() => navigate('/tickets')}
          className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
        >
          Ver todos
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-8">
          <Ticket className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 text-sm mb-4">No tienes tickets activos</p>
          <button
            onClick={() => navigate('/tickets')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Ticket</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              className="p-4 border border-neutral-200 rounded-xl hover:shadow-medium transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-bold text-primary-600">
                  {ticket.folio}
                </span>
                <div className="flex items-center space-x-2">
                  {ticket.estatus && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: ticket.estatus.color + '20',
                        color: ticket.estatus.color
                      }}
                    >
                      {ticket.estatus.nombre}
                    </span>
                  )}
                  <AlertCircle className={`w-4 h-4 ${getPrioridadColor(ticket.prioridad)}`} />
                </div>
              </div>
              <p className="text-sm text-neutral-700 line-clamp-2">
                {ticket.instrucciones}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
