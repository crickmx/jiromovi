import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, Pin, ArrowRight } from 'lucide-react';
import { obtenerComunicadoFijado, obtenerComunicados, extraerTextoPlano, formatearFecha } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';

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

      // Primero intentar obtener el comunicado fijado
      const fijado = await obtenerComunicadoFijado();

      if (fijado) {
        setComunicado(fijado);
      } else {
        // Si no hay fijado, obtener el más reciente
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!comunicado) {
    return null;
  }

  // Verificar si fue creado por gerente
  const esDeGerente = !!comunicado.oficina_origen_id;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
        esDeGerente
          ? 'border-l-4 border-l-[#0050D1] border-t-gray-200 border-r-gray-200 border-b-gray-200'
          : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Último Comunicado
            </h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/comunicados');
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
          >
            Ver todos
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div
        onClick={() => navigate(`/comunicados/${comunicado.id}`)}
        className="p-6 cursor-pointer group"
      >
        <div className="flex gap-4">
          {/* Imagen miniatura */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-lg overflow-hidden">
            <img
              src={comunicado.imagen_principal}
              alt={comunicado.titulo}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {comunicado.fijado && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                  <Pin className="w-3 h-3" />
                  Destacado
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                {comunicado.categoria?.nombre}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                <Calendar className="w-3 h-3" />
                {formatearFecha(comunicado.fecha_publicacion || comunicado.fecha_creacion)}
              </span>
            </div>

            {/* Título */}
            <h4 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
              {comunicado.titulo}
            </h4>

            {/* Extracto */}
            <p className="text-gray-600 text-sm line-clamp-2 sm:line-clamp-3">
              {extraerTextoPlano(comunicado.contenido_html, 150)}
            </p>

            {/* Link */}
            <button className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 group/btn">
              Leer más
              <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
