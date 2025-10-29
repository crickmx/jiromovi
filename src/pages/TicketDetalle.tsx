import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Edit2, XCircle, RefreshCw, Save } from 'lucide-react';
import { TicketDetalles } from '../components/tickets/TicketDetalles';
import { TicketComentarios } from '../components/tickets/TicketComentarios';
import { TicketArchivos } from '../components/tickets/TicketArchivos';
import { TicketHistorial } from '../components/tickets/TicketHistorial';

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

export function TicketDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalles' | 'comentarios' | 'archivos' | 'historial'>('detalles');

  const [editing, setEditing] = useState(false);
  const [estatusList, setEstatusList] = useState<TicketEstatus[]>([]);
  const [selectedEstatus, setSelectedEstatus] = useState('');
  const [selectedPrioridad, setSelectedPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [saving, setSaving] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canEdit = isAdmin || isGerente;
  const isCerrado = ticket?.cerrado_en !== null;

  useEffect(() => {
    if (id) {
      loadTicket();
      loadEstatus();

      const subscription = supabase
        .channel(`ticket_${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tickets',
            filter: `id=eq.${id}`
          },
          async () => {
            await loadTicket();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [id]);

  const loadTicket = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        agente:agente_id(id, nombre_completo),
        estatus:estatus_id(*),
        creado_por_usuario:creado_por(id, nombre_completo),
        modificado_por_usuario:modificado_por(id, nombre_completo),
        cerrado_por_usuario:cerrado_por(id, nombre_completo)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading ticket:', error);
      navigate('/tickets');
      return;
    }

    if (data) {
      setTicket(data as TicketData);
      setSelectedEstatus(data.estatus_id);
      setSelectedPrioridad(data.prioridad);
      setLoading(false);
    }
  };

  const loadEstatus = async () => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) setEstatusList(data);
  };

  const handleSave = async () => {
    if (!ticket || !usuario) return;

    setSaving(true);

    const newEstatus = estatusList.find(e => e.id === selectedEstatus);
    setTicket(prev => prev ? {
      ...prev,
      prioridad: selectedPrioridad,
      estatus: newEstatus || prev.estatus
    } : null);
    setEditing(false);

    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: selectedEstatus,
          prioridad: selectedPrioridad,
          modificado_por: usuario.id
        })
        .eq('id', ticket.id);

      if (error) throw error;

      await supabase
        .from('ticket_historial')
        .insert({
          ticket_id: ticket.id,
          usuario_id: usuario.id,
          accion: 'Actualización',
          descripcion: `Estatus: ${newEstatus?.nombre}, Prioridad: ${selectedPrioridad}`
        });

      await loadTicket();
    } catch (err: any) {
      console.error('Error updating ticket:', err);
      alert('Error al actualizar el ticket');
      await loadTicket();
    } finally {
      setSaving(false);
    }
  };

  const handleCerrar = async () => {
    if (!ticket || !usuario) return;
    if (!confirm('¿Estás seguro de cerrar este ticket?')) return;

    setSaving(true);
    try {
      const estatusCerrado = estatusList.find(e => e.nombre === 'Cerrado');
      if (!estatusCerrado) throw new Error('No se encontró el estatus "Cerrado"');

      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: estatusCerrado.id,
          cerrado_en: new Date().toISOString(),
          cerrado_por: usuario.id,
          modificado_por: usuario.id
        })
        .eq('id', ticket.id);

      if (error) throw error;

      await loadTicket();
    } catch (err: any) {
      console.error('Error closing ticket:', err);
      alert('Error al cerrar el ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleReabrir = async () => {
    if (!ticket || !usuario) return;
    if (!confirm('¿Estás seguro de reabrir este ticket?')) return;

    setSaving(true);
    try {
      const estatusEnProceso = estatusList.find(e => e.nombre === 'En proceso');
      if (!estatusEnProceso) throw new Error('No se encontró el estatus "En proceso"');

      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: estatusEnProceso.id,
          cerrado_en: null,
          cerrado_por: null,
          modificado_por: usuario.id
        })
        .eq('id', ticket.id);

      if (error) throw error;

      await loadTicket();
    } catch (err: any) {
      console.error('Error reopening ticket:', err);
      alert('Error al reabrir el ticket');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">Ticket no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/tickets')}
            className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Volver a Tickets</span>
          </button>

          <div className="flex items-center space-x-2">
            {canEdit && !isCerrado && (
              <>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all font-semibold"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setSelectedEstatus(ticket.estatus?.id || '');
                        setSelectedPrioridad(ticket.prioridad);
                      }}
                      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleCerrar}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cerrar Ticket</span>
                </button>
              </>
            )}
            {canEdit && isCerrado && (
              <button
                onClick={handleReabrir}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reabrir Ticket</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
            Ticket {ticket.folio}
          </h1>
          <div className="flex items-center space-x-3">
            {ticket.estatus && (
              <span
                className="px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: ticket.estatus.color + '20',
                  color: ticket.estatus.color,
                  borderColor: ticket.estatus.color,
                  borderWidth: '1px'
                }}
              >
                {ticket.estatus.nombre}
              </span>
            )}
            {isCerrado && (
              <span className="text-sm text-neutral-500">
                Cerrado el {new Date(ticket.cerrado_en!).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>
        </div>

        <div className="flex space-x-2 border-b border-neutral-200 mt-6">
          {(['detalles', 'comentarios', 'archivos', 'historial'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        {activeTab === 'detalles' && (
          <TicketDetalles
            ticket={ticket}
            editing={editing}
            estatusList={estatusList}
            selectedEstatus={selectedEstatus}
            setSelectedEstatus={setSelectedEstatus}
            selectedPrioridad={selectedPrioridad}
            setSelectedPrioridad={setSelectedPrioridad}
          />
        )}
        {activeTab === 'comentarios' && <TicketComentarios ticketId={ticket.id} />}
        {activeTab === 'archivos' && <TicketArchivos ticketId={ticket.id} />}
        {activeTab === 'historial' && <TicketHistorial ticketId={ticket.id} />}
      </div>
    </div>
  );
}
