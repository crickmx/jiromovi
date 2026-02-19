import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './ui/empty-state';

interface Sesion {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  duracion_minutos: number;
  instructor?: { id: string; nombre_completo: string } | null;
  esta_activa: boolean;
  estado: 'programada' | 'en_vivo' | 'finalizada' | 'cancelada';
  tipo: 'sesion' | 'evento';
}

export function ProximasCapacitaciones() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSesiones();
  }, [usuario]);

  const fetchSesiones = async () => {
    if (!usuario) return;

    try {
      const { data: sesionesData, error: sesionesError } = await supabase
        .from('aula_virtual_sesiones')
        .select(`
          id,
          titulo,
          descripcion,
          fecha_inicio,
          duracion_minutos,
          esta_activa,
          estado,
          instructor:usuarios!aula_virtual_sesiones_instructor_id_fkey(id, nombre_completo)
        `)
        .eq('estado', 'programada')
        .gte('fecha_inicio', new Date().toISOString())
        .order('fecha_inicio', { ascending: true });

      if (sesionesError) throw sesionesError;

      const { data: eventosData, error: eventosError } = await supabase
        .from('aula_eventos')
        .select(`
          id,
          titulo,
          descripcion,
          fecha,
          hora,
          ponente
        `)
        .gte('fecha', new Date().toISOString().split('T')[0])
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      if (eventosError) throw eventosError;

      const sesionesFormateadas: Sesion[] = (sesionesData || []).map(s => ({
        ...s,
        tipo: 'sesion' as const
      }));

      const eventosFormateados: Sesion[] = (eventosData || []).map(e => {
        const fechaInicio = `${e.fecha}T${e.hora}`;
        return {
          id: e.id,
          titulo: e.titulo,
          descripcion: e.descripcion,
          fecha_inicio: fechaInicio,
          duracion_minutos: 60,
          instructor: { id: '', nombre_completo: e.ponente },
          esta_activa: false,
          estado: 'programada' as const,
          tipo: 'evento' as const
        };
      });

      const todas = [...sesionesFormateadas, ...eventosFormateados]
        .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
        .slice(0, 5);

      setSesiones(todas);
    } catch (error) {
      console.error('Error fetching sesiones y eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
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
              <Calendar className="w-5 h-5 text-accent" />
              Próximas Capacitaciones
            </CardTitle>
            <CardDescription className="mt-1">
              Sesiones y eventos programados
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sesiones.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No hay capacitaciones programadas"
          />
        ) : (
          <div className="space-y-3">
            {sesiones.map((sesion) => {
              const fechaSesion = new Date(sesion.fecha_inicio);
              const fechaStr = format(fechaSesion, "dd 'de' MMMM", { locale: es });
              const horaStr = format(fechaSesion, 'HH:mm', { locale: es });

              return (
                <div
                  key={sesion.id}
                  onClick={() => navigate('/seguros-education/aula-virtual')}
                  className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 hover:bg-neutral-100 hover:border-primary-200 hover:shadow-ios transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-neutral-900 text-sm line-clamp-1 flex-1">
                      {sesion.titulo}
                    </h3>
                    <Badge
                      variant={sesion.tipo === 'evento' ? 'success' : 'default'}
                      className="ml-2 text-xs"
                    >
                      {sesion.tipo === 'evento' ? 'Evento' : 'Sesión'}
                    </Badge>
                  </div>

                  {sesion.descripcion && (
                    <p className="text-xs text-neutral-600 mb-3 line-clamp-2">
                      {sesion.descripcion}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {fechaStr}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {horaStr} ({sesion.duracion_minutos} min)
                    </span>
                    {sesion.instructor && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {sesion.instructor.nombre_completo}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          onClick={() => navigate('/seguros-education/aula-virtual')}
          className="w-full mt-4"
          variant="default"
        >
          Ver Todas las Sesiones
        </Button>
      </CardContent>
    </Card>
  );
}
