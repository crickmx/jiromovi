import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Activity } from 'lucide-react';

interface HistorialItem {
  id: string;
  accion: string;
  detalle: any;
  fecha_hora: string;
  usuario: {
    nombre_completo: string;
  } | null;
}

interface TramiteHistorialProps {
  tramiteId: string;
}

export function TramiteHistorial({ tramiteId }: TramiteHistorialProps) {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistorial();

    const subscription = supabase
      .channel(`tramite_historial_${tramiteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tramite_historial',
          filter: `tramite_id=eq.${tramiteId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('tramite_historial')
            .select('*, usuario:usuario_id(nombre_completo)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setHistorial(prev => [data as HistorialItem, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tramiteId]);

  const loadHistorial = async () => {
    const { data } = await supabase
      .from('tramite_historial')
      .select('*, usuario:usuario_id(nombre_completo)')
      .eq('tramite_id', tramiteId)
      .order('fecha_hora', { ascending: false });

    if (data) setHistorial(data as HistorialItem[]);
    setLoading(false);
  };

  const getAccionColor = (accion: string) => {
    if (accion.includes('creado')) return 'bg-green-100 text-green-700 border-green-300';
    if (accion.includes('cerrado')) return 'bg-red-100 text-red-700 border-red-300';
    if (accion.includes('reabierto')) return 'bg-primary-100 text-primary-700 border-primary-300';
    if (accion.includes('actualizado')) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (accion.includes('Comentario')) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (accion.includes('Archivo')) return 'bg-purple-100 text-purple-700 border-purple-300';
    if (accion.includes('asignado')) return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-neutral-100 text-neutral-700 border-neutral-300';
  };

  const formatDetalle = (key: string, value: any) => {
    const labels: Record<string, string> = {
      'folio': 'Folio',
      'agente': 'Agente',
      'estatus': 'Estatus',
      'prioridad': 'Prioridad',
      'poliza': 'Póliza',
      'estatus_anterior': 'Estatus anterior',
      'estatus_nuevo': 'Nuevo estatus',
      'prioridad_anterior': 'Prioridad anterior',
      'prioridad_nueva': 'Nueva prioridad',
      'agente_anterior': 'Agente anterior',
      'agente_nuevo': 'Nuevo agente',
      'cerrado_por': 'Cerrado por',
      'fecha_cierre': 'Fecha de cierre',
      'fecha_reapertura': 'Fecha de reapertura',
      'poliza_anterior': 'Póliza anterior',
      'poliza_nueva': 'Nueva póliza',
      'usuario': 'Usuario',
      'mensaje_preview': 'Mensaje',
      'nombre_archivo': 'Archivo',
      'tipo': 'Tipo',
      'tamano_mb': 'Tamaño',
      'ejecutivo': 'Ejecutivo',
      'asignado_por': 'Asignado por'
    };

    const label = labels[key] || key.replace(/_/g, ' ');

    if (key === 'fecha_cierre' || key === 'fecha_reapertura') {
      return `${label}: ${new Date(value).toLocaleString('es-MX')}`;
    }

    if (key === 'tamano_mb') {
      return `${label}: ${value} MB`;
    }

    return `${label}: ${value}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-neutral-900">
        <Activity className="w-5 h-5 inline mr-2" />
        Historial de Cambios ({historial.length})
      </h3>

      {historial.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <Clock className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <p>No hay historial disponible</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200"></div>
          <div className="space-y-6">
            {historial.map((item, index) => (
              <div key={item.id} className="relative flex items-start space-x-4 ml-2">
                <div className="flex-shrink-0 w-8 h-8 bg-white border-2 border-accent rounded-full flex items-center justify-center z-10">
                  <Clock className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 bg-white border border-neutral-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getAccionColor(item.accion)}`}>
                      {item.accion}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(item.fecha_hora).toLocaleString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {item.usuario && (
                    <p className="text-sm text-neutral-600 mb-2">
                      Por: <span className="font-semibold text-neutral-900">{item.usuario.nombre_completo}</span>
                    </p>
                  )}

                  {item.detalle && Object.keys(item.detalle).length > 0 && (
                    <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
                      <p className="text-xs font-semibold text-neutral-700 mb-2">Detalles:</p>
                      <div className="text-xs text-neutral-600 space-y-1.5">
                        {Object.entries(item.detalle).map(([key, value]: [string, any]) => {
                          if (typeof value === 'object' && value !== null) {
                            return (
                              <div key={key} className="space-y-1">
                                <span className="font-medium capitalize block">{key.replace(/_/g, ' ')}:</span>
                                <pre className="ml-3 text-xs bg-white p-2 rounded border border-neutral-200 overflow-x-auto">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            );
                          }
                          return (
                            <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                              <span className="font-medium text-neutral-700">{formatDetalle(key, value).split(':')[0]}:</span>
                              <span className="text-neutral-900">{formatDetalle(key, value).split(':').slice(1).join(':').trim()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
