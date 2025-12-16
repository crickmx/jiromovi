import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './ui/empty-state';

interface TramiteItem {
  id: string;
  folio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  instrucciones: string;
  estatus: {
    nombre: string;
    color: string;
  } | null;
}

export function TramitesWidget() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [tramites, setTramites] = useState<TramiteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTramites();
  }, []);

  const loadTramites = async () => {
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

    if (data) setTramites(data as TramiteItem[]);
    setLoading(false);
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'text-ios-red';
      case 'Media': return 'text-ios-orange';
      case 'Baja': return 'text-ios-green';
      default: return 'text-neutral-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary-500" />
            <CardTitle>Mis Trámites Activos</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tramites')}
            className="text-primary-500 hover:text-primary-600"
          >
            Ver todos
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {tramites.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tienes trámites activos"
            action={{
              label: "Crear Trámite",
              onClick: () => navigate('/tramites')
            }}
          />
        ) : (
          <div className="space-y-3">
            {tramites.map((tramite) => (
              <div
                key={tramite.id}
                onClick={() => navigate(`/tramites/${tramite.id}`)}
                className="p-4 border border-neutral-200 rounded-xl hover:shadow-ios-md hover:border-primary-200 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-bold text-primary-500">
                    {tramite.folio}
                  </span>
                  <div className="flex items-center gap-2">
                    {tramite.estatus && (
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: tramite.estatus.color + '20',
                          borderColor: tramite.estatus.color + '40',
                          color: tramite.estatus.color
                        }}
                      >
                        {tramite.estatus.nombre}
                      </Badge>
                    )}
                    <AlertCircle className={`w-4 h-4 ${getPrioridadColor(tramite.prioridad)}`} />
                  </div>
                </div>
                <p className="text-sm text-neutral-700 line-clamp-2">
                  {tramite.instrucciones}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
