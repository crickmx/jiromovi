import { useState, useEffect } from 'react';
import { X, Search, BookMarked } from 'lucide-react';
import { obtenerGlosario, buscarTerminoGlosario } from '../../lib/cedulaAUtils';
import type { CedulaAGlosario } from '../../lib/cedulaATypes';

interface Props {
  moduloId?: string;
  onClose: () => void;
}

export default function GlosarioModal({ moduloId, onClose }: Props) {
  const [terminos, setTerminos] = useState<CedulaAGlosario[]>([]);
  const [terminosFiltrados, setTerminosFiltrados] = useState<CedulaAGlosario[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [terminoSeleccionado, setTerminoSeleccionado] = useState<CedulaAGlosario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarGlosario();
  }, [moduloId]);

  useEffect(() => {
    if (busqueda.trim()) {
      const filtered = terminos.filter(t =>
        t.termino.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.definicion.toLowerCase().includes(busqueda.toLowerCase())
      );
      setTerminosFiltrados(filtered);
    } else {
      setTerminosFiltrados(terminos);
    }
  }, [busqueda, terminos]);

  const cargarGlosario = async () => {
    try {
      setLoading(true);
      const data = await obtenerGlosario(moduloId);
      setTerminos(data);
      setTerminosFiltrados(data);
    } catch (error) {
      console.error('Error cargando glosario:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-ios-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-ios-xl animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-ios flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Glosario de Términos</h2>
              <p className="text-sm text-neutral-600">Definiciones clave del curso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-ios transition-colors"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        <div className="p-6 border-b border-neutral-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar término..."
              className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-1/3 border-r border-neutral-200 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-neutral-600">Cargando...</p>
              </div>
            ) : terminosFiltrados.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-neutral-600">No se encontraron términos</p>
              </div>
            ) : (
              <div className="p-2">
                {terminosFiltrados.map((termino) => (
                  <button
                    key={termino.id}
                    onClick={() => setTerminoSeleccionado(termino)}
                    className={`w-full text-left px-4 py-3 rounded-ios-lg transition-colors ${
                      terminoSeleccionado?.id === termino.id
                        ? 'bg-primary-50 text-primary-900'
                        : 'hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <h3 className="font-semibold">{termino.termino}</h3>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {terminoSeleccionado ? (
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-4">
                  {terminoSeleccionado.termino}
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                      Definición
                    </h4>
                    <p className="text-neutral-700 leading-relaxed">
                      {terminoSeleccionado.definicion}
                    </p>
                  </div>
                  {terminoSeleccionado.ejemplo && (
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-600 uppercase tracking-wide mb-2">
                        Ejemplo
                      </h4>
                      <div className="bg-emerald-50 rounded-ios-lg p-4">
                        <p className="text-neutral-700 leading-relaxed">
                          {terminoSeleccionado.ejemplo}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <BookMarked className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-600">Selecciona un término para ver su definición</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
