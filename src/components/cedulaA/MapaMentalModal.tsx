import { useState, useEffect } from 'react';
import { X, BookOpen, ZoomIn, ZoomOut } from 'lucide-react';
import { obtenerMapasMentales } from '../../lib/cedulaAUtils';
import type { CedulaAMapaMental } from '../../lib/cedulaATypes';

interface Props {
  moduloId?: string;
  onClose: () => void;
}

export default function MapaMentalModal({ moduloId, onClose }: Props) {
  const [mapas, setMapas] = useState<CedulaAMapaMental[]>([]);
  const [mapaSeleccionado, setMapaSeleccionado] = useState<CedulaAMapaMental | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarMapas();
  }, [moduloId]);

  const cargarMapas = async () => {
    try {
      setLoading(true);
      const data = await obtenerMapasMentales(moduloId);
      setMapas(data);
      if (data.length > 0) {
        setMapaSeleccionado(data[0]);
      }
    } catch (error) {
      console.error('Error cargando mapas mentales:', error);
    } finally {
      setLoading(false);
    }
  };

  const aumentarZoom = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const reducirZoom = () => setZoom(prev => Math.max(prev - 0.1, 0.5));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-ios-xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-ios-xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-ios flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Mapas Mentales</h2>
              <p className="text-sm text-neutral-600">Visualización conceptual del contenido</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-ios transition-colors"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-neutral-600">Cargando mapas...</p>
            </div>
          </div>
        ) : mapas.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-neutral-600">No hay mapas mentales disponibles para este módulo</p>
          </div>
        ) : (
          <>
            {mapas.length > 1 && (
              <div className="px-6 py-3 border-b border-neutral-200 flex gap-2 overflow-x-auto">
                {mapas.map((mapa) => (
                  <button
                    key={mapa.id}
                    onClick={() => setMapaSeleccionado(mapa)}
                    className={`px-4 py-2 rounded-ios-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      mapaSeleccionado?.id === mapa.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {mapa.titulo}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full bg-neutral-50 rounded-ios-xl overflow-auto">
                {mapaSeleccionado && (
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-neutral-900 mb-2 text-center">
                      {mapaSeleccionado.titulo}
                    </h3>
                    {mapaSeleccionado.descripcion && (
                      <p className="text-neutral-600 mb-6 text-center">
                        {mapaSeleccionado.descripcion}
                      </p>
                    )}
                    <div className="flex items-center justify-center">
                      <p className="text-neutral-500 text-sm">
                        Los mapas mentales interactivos estarán disponibles próximamente
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 flex items-center justify-center gap-2">
              <button
                onClick={reducirZoom}
                className="p-2 hover:bg-neutral-100 rounded-ios transition-colors"
                title="Reducir zoom"
              >
                <ZoomOut className="w-5 h-5 text-neutral-600" />
              </button>
              <span className="text-sm text-neutral-600 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={aumentarZoom}
                className="p-2 hover:bg-neutral-100 rounded-ios transition-colors"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-5 h-5 text-neutral-600" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
