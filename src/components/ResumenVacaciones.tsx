import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { formatearFecha } from '../lib/vacacionesUtils';
import type { Database } from '../lib/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './ui/empty-state';

type SolicitudVacaciones = Database['public']['Tables']['solicitudes_vacaciones']['Row'] & {
  empleado?: { nombre: string; apellidos: string } | null;
  oficinas?: { nombre: string } | null;
};

export function ResumenVacaciones() {
  const navigate = useNavigate();
  const { usuario: currentUser } = useAuth();
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudVacaciones[]>([]);
  const [solicitudesPreaprobadas, setSolicitudesPreaprobadas] = useState<SolicitudVacaciones[]>([]);
  const [loading, setLoading] = useState(true);

  const isGerente = currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';

  useEffect(() => {
    if (isGerente || isAdmin) {
      loadSolicitudes();
    } else {
      setLoading(false);
    }
  }, [isGerente, isAdmin]);

  const loadSolicitudes = async () => {
    setLoading(true);
    try {
      if (isGerente && currentUser?.oficina_id) {
        const { data, error } = await supabase
          .from('solicitudes_vacaciones')
          .select('*, empleado:usuarios!usuario_id(nombre_completo)')
          .eq('oficina_id', currentUser.oficina_id)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error loading vacation requests for Gerente:', error);
        } else {
          setSolicitudesPendientes(data || []);
        }
      } else if (isAdmin) {
        const { data, error } = await supabase
          .from('solicitudes_vacaciones')
          .select('*, empleado:usuarios!usuario_id(nombre_completo, oficina_id, oficinas(nombre))')
          .eq('estado', 'preaprobado')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error loading vacation requests for Admin:', error);
        } else {
          setSolicitudesPreaprobadas(data || []);
        }
      }
    } catch (error) {
      console.error('Error loading vacation requests:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isGerente && !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const solicitudes = isGerente ? solicitudesPendientes : solicitudesPreaprobadas;
  const titulo = isGerente ? 'Solicitudes de Vacaciones Pendientes' : 'Solicitudes Preaprobadas';
  const estadoBadge = isGerente ? 'warning' : 'default';
  const estadoLabel = isGerente ? 'Pendiente' : 'Preaprobado';

  if (solicitudes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            {titulo}
          </CardTitle>
          <CardDescription>
            No hay solicitudes en este momento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={AlertCircle}
            title={`No hay solicitudes de vacaciones ${isGerente ? 'pendientes' : 'preaprobadas'}`}
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
              <Calendar className="w-5 h-5 text-accent" />
              {titulo}
            </CardTitle>
            <CardDescription className="mt-1">
              {solicitudes.length} {solicitudes.length === 1 ? 'solicitud requiere' : 'solicitudes requieren'} tu atención
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/vacaciones')}
            className="text-accent hover:text-accent"
          >
            Ver todas →
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {solicitudes.map((solicitud) => (
            <div
              key={solicitud.id}
              className="border border-neutral-200 rounded-xl p-4 hover:bg-neutral-50 hover:border-primary-200 transition cursor-pointer"
              onClick={() => navigate('/vacaciones')}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-sm">
                    {solicitud.empleado?.nombre_completo}
                  </h3>
                  {isAdmin && solicitud.empleado?.oficinas && (
                    <p className="text-xs text-neutral-600">{solicitud.empleado.oficinas.nombre}</p>
                  )}
                </div>
                <Badge variant={estadoBadge} className="text-xs">
                  {estadoLabel}
                </Badge>
              </div>
              <div className="flex items-center flex-wrap gap-3 text-xs text-neutral-700">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatearFecha(solicitud.fecha_inicio)} - {formatearFecha(solicitud.fecha_fin)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {solicitud.dias_solicitados} días
                </span>
              </div>
            </div>
          ))}
        </div>

        {solicitudes.length >= 5 && (
          <Button
            variant="ghost"
            className="w-full mt-4 text-accent hover:text-accent"
            onClick={() => navigate('/vacaciones')}
          >
            Ver más solicitudes
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
