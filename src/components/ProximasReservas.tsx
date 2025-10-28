import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Calendar, Clock, ArrowRight } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Reserva = Database['public']['Tables']['reservas_espacio']['Row'] & {
  espacios_jiro?: { nombre: string } | null;
};

export function ProximasReservas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcomingReservas();
  }, [usuario]);

  const loadUpcomingReservas = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('reservas_espacio')
        .select('*, espacios_jiro(nombre)')
        .eq('usuario_id', usuario.id)
        .eq('estado', 'confirmada')
        .gte('fecha_inicio', now)
        .order('fecha_inicio', { ascending: true })
        .limit(5);

      if (error) throw error;
      setReservas(data || []);
    } catch (error) {
      console.error('Error loading upcoming reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return { date: dateStr, time: timeStr };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (reservas.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-amber-100 rounded-lg">
            <MapPin className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Reservas</h2>
            <p className="text-sm text-slate-600">Espacio JIRO</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-500 mb-4">No tienes reservas próximas</p>
          <button
            onClick={() => navigate('/espacio-jiro')}
            className="text-amber-600 hover:text-amber-700 font-medium text-sm"
          >
            Hacer una reserva →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <MapPin className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Reservas</h2>
            <p className="text-sm text-slate-600">
              {reservas.length} {reservas.length === 1 ? 'reserva confirmada' : 'reservas confirmadas'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/espacio-jiro')}
          className="text-amber-600 hover:text-amber-700 text-sm font-medium"
        >
          Ver todas →
        </button>
      </div>

      <div className="space-y-3">
        {reservas.map((reserva) => {
          const { date: dateInicio, time: timeInicio } = formatDateTime(reserva.fecha_inicio);
          const { time: timeFin } = formatDateTime(reserva.fecha_fin);
          return (
            <div
              key={reserva.id}
              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {reserva.espacios_jiro?.nombre || 'Espacio'}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-slate-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {dateInicio}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {timeInicio} - {timeFin}
                    </span>
                  </div>
                  {reserva.proposito && (
                    <p className="text-sm text-slate-500 mt-2">{reserva.proposito}</p>
                  )}
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  Confirmada
                </span>
              </div>

              <button
                onClick={() => navigate('/espacio-jiro')}
                className="w-full flex items-center justify-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition font-medium"
              >
                <span>Ver detalles</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {reservas.length >= 5 && (
        <button
          onClick={() => navigate('/espacio-jiro')}
          className="w-full mt-4 text-center text-sm text-amber-600 hover:text-amber-700 font-medium py-2 hover:bg-amber-50 rounded-lg transition"
        >
          Ver más reservas
        </button>
      )}
    </div>
  );
}
