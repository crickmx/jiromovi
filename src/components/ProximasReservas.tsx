import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Calendar, Clock, ArrowRight } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './ui/empty-state';

type Reserva = Database['public']['Tables']['reservas_espacio']['Row'] & {
  areas?: { nombre: string } | null;
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
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('reservas_espacio')
        .select('*, areas(nombre)')
        .eq('usuario_id', usuario.id)
        .in('estado', ['pendiente', 'aprobada'])
        .gte('fecha', today)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(5);

      if (error) throw error;
      setReservas(data || []);
    } catch (error) {
      console.error('Error loading upcoming reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (reservas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            Próximas Reservas
          </CardTitle>
          <CardDescription>Espacio JIRO</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={MapPin}
            title="No tienes reservas próximas"
            action={{
              label: "Hacer una reserva",
              onClick: () => navigate('/espacio-jiro')
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" />
              Próximas Reservas
            </CardTitle>
            <CardDescription>
              {reservas.length} {reservas.length === 1 ? 'reserva confirmada' : 'reservas confirmadas'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/espacio-jiro')}
            className="text-amber-500 hover:text-amber-600"
          >
            Ver todas →
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {reservas.map((reserva) => {
            const estadoBadge = reserva.estado === 'aprobada' ? 'success' : 'warning';
            const estadoLabel = reserva.estado === 'aprobada' ? 'Aprobada' : 'Pendiente';

            return (
              <div
                key={reserva.id}
                className="border border-neutral-200 rounded-xl p-4 hover:bg-neutral-50 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-2 text-sm">
                      {reserva.areas?.nombre || 'Espacio'}
                    </h3>
                    <div className="flex items-center flex-wrap gap-3 text-xs text-neutral-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(reserva.fecha)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(reserva.hora_inicio)} - {formatTime(reserva.hora_fin)}
                      </span>
                    </div>
                    {reserva.notas && (
                      <p className="text-xs text-neutral-500 mt-2">{reserva.notas}</p>
                    )}
                  </div>
                  <Badge variant={estadoBadge}>
                    {estadoLabel}
                  </Badge>
                </div>

                <Button
                  onClick={() => navigate('/espacio-jiro')}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  size="sm"
                >
                  Ver detalles
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            );
          })}
        </div>

        {reservas.length >= 5 && (
          <Button
            variant="ghost"
            className="w-full mt-4 text-amber-500 hover:text-amber-600"
            onClick={() => navigate('/espacio-jiro')}
          >
            Ver más reservas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
