import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Building2, Calendar, Paperclip, AlertCircle } from 'lucide-react';

interface ComisionPendiente {
  id: string;
  numero_poliza: string | null;
  aseguradora: string | null;
  fecha_pago: string | null;
  orden: number;
  created_at: string;
}

interface Archivo {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamano: number;
}

interface ComisionesPendientesProps {
  tramiteId: string;
}

export function ComisionesPendientes({ tramiteId }: ComisionesPendientesProps) {
  const [comisiones, setComisiones] = useState<ComisionPendiente[]>([]);
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComisiones();
    loadArchivos();
  }, [tramiteId]);

  const loadComisiones = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ticket_comisiones_pendientes')
      .select('*')
      .eq('ticket_id', tramiteId)
      .order('orden');

    if (data) setComisiones(data);
    setLoading(false);
  };

  const loadArchivos = async () => {
    const { data } = await supabase
      .from('ticket_archivos')
      .select('*')
      .eq('ticket_id', tramiteId)
      .order('fecha_subida', { ascending: false });

    if (data) setArchivos(data);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (comisiones.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
        <p className="text-neutral-600">No hay comisiones pendientes registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">
              Comisiones Pendientes de Pago
            </h3>
            <p className="text-sm text-blue-800">
              Total de comisiones reportadas: {comisiones.length}
            </p>
          </div>
        </div>
      </div>

      {comisiones.map((comision, index) => {
        // Buscar archivo asociado basado en el orden
        const archivoAsociado = archivos[index];

        return (
          <div
            key={comision.id}
            className="bg-white border border-neutral-200 rounded-xl p-5 hover:shadow-soft transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-accent">
                Comisión #{comision.orden}
              </h3>
              <span className="text-xs text-neutral-500">
                {new Date(comision.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                  <FileText className="w-4 h-4" />
                  Número de Póliza
                </label>
                <p className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                  {comision.numero_poliza || 'No especificado'}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                  <Building2 className="w-4 h-4" />
                  Aseguradora
                </label>
                <p className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                  {comision.aseguradora || 'No especificada'}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                  <Calendar className="w-4 h-4" />
                  Fecha de Pago
                </label>
                <p className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900">
                  {comision.fecha_pago
                    ? new Date(comision.fecha_pago).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'No especificada'}
                </p>
              </div>

              {archivoAsociado && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                    <Paperclip className="w-4 h-4" />
                    Archivo Adjunto
                  </label>
                  <a
                    href={archivoAsociado.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 hover:bg-primary-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm truncate">{archivoAsociado.nombre}</span>
                    <span className="text-xs text-accent ml-auto">
                      {(archivoAsociado.tamano / 1024).toFixed(2)} KB
                    </span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
