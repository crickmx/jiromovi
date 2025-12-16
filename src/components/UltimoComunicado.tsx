import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Pin, ArrowRight } from 'lucide-react';
import { obtenerComunicadoFijado, obtenerComunicados, extraerTextoPlano, formatearFecha } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

export function UltimoComunicado() {
  const navigate = useNavigate();
  const [comunicado, setComunicado] = useState<ComunicadoPublicacion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarComunicado();
  }, []);

  const cargarComunicado = async () => {
    try {
      setLoading(true);
      const fijado = await obtenerComunicadoFijado();

      if (fijado) {
        setComunicado(fijado);
      } else {
        const recientes = await obtenerComunicados(1, 0);
        if (recientes.length > 0) {
          setComunicado(recientes[0]);
        }
      }
    } catch (error) {
      console.error('Error cargando último comunicado:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4">
            <Skeleton className="w-32 h-32 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!comunicado) {
    return null;
  }

  const esDeGerente = !!comunicado.oficina_origen_id;

  return (
    <Card className={esDeGerente ? "border-l-4 border-l-primary-500" : ""}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-500" />
            <CardTitle>Último Comunicado</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/comunicados');
            }}
            className="text-primary-500 hover:text-primary-600"
          >
            Ver todos
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          onClick={() => navigate(`/comunicados/${comunicado.id}`)}
          className="cursor-pointer group"
        >
          <div className="flex gap-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden">
              <img
                src={comunicado.imagen_principal}
                alt={comunicado.titulo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {comunicado.fijado && (
                  <Badge variant="warning" className="gap-1">
                    <Pin className="w-3 h-3" />
                    Destacado
                  </Badge>
                )}
                <Badge variant="default">
                  {comunicado.categoria?.nombre}
                </Badge>
                <span className="inline-flex items-center gap-1 text-neutral-500 text-xs">
                  <Calendar className="w-3 h-3" />
                  {formatearFecha(comunicado.fecha_publicacion || comunicado.fecha_creacion)}
                </span>
              </div>

              <h4 className="text-lg font-bold text-neutral-900 mb-2 group-hover:text-primary-500 transition-colors line-clamp-2">
                {comunicado.titulo}
              </h4>

              <p className="text-neutral-600 text-sm line-clamp-2 sm:line-clamp-3 mb-3">
                {extraerTextoPlano(comunicado.contenido_html, 150)}
              </p>

              <button className="text-primary-500 hover:text-primary-600 font-medium text-sm flex items-center gap-1 group/btn">
                Leer más
                <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
