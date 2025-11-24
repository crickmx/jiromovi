import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Calendar, Pin, FileText, Settings } from 'lucide-react';
import { obtenerComunicados } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';
import { extraerTextoPlano, formatearFecha } from '../lib/comunicadosUtils';

export default function Comunicados() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [comunicados, setComunicados] = useState<ComunicadoPublicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const esAdmin = usuario?.rol === 'Administrador';
  const ITEMS_PER_PAGE = 10;

  const cargarComunicados = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const offset = pageNum * ITEMS_PER_PAGE;
      const data = await obtenerComunicados(ITEMS_PER_PAGE, offset);

      if (data.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      if (pageNum === 0) {
        setComunicados(data);
      } else {
        setComunicados(prev => [...prev, ...data]);
      }
    } catch (error) {
      console.error('Error cargando comunicados:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    cargarComunicados(0);
  }, [cargarComunicados]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loadingMore, loading]);

  useEffect(() => {
    if (page > 0) {
      cargarComunicados(page);
    }
  }, [page, cargarComunicados]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Botones de acción admin */}
        {esAdmin && (
          <div className="flex items-center gap-3 mb-4 justify-end">
            <button
              onClick={() => navigate('/comunicados/categorias')}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Categorías</span>
            </button>
            <button
              onClick={() => navigate('/comunicados/nuevo')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Nuevo Comunicado
            </button>
          </div>
        )}

        {/* Lista de comunicados */}
        {comunicados.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No hay comunicados publicados
            </h3>
            <p className="text-gray-500">
              {esAdmin
                ? 'Comienza creando tu primer comunicado'
                : 'Pronto habrá novedades que compartir'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {comunicados.map((comunicado) => (
              <article
                key={comunicado.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer"
                onClick={() => navigate(`/comunicados/${comunicado.id}`)}
              >
                <div className="flex flex-col md:flex-row">
                  {/* Imagen */}
                  <div className="md:w-72 h-48 md:h-auto overflow-hidden flex-shrink-0">
                    <img
                      src={comunicado.imagen_principal}
                      alt={comunicado.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 p-6">
                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      {comunicado.fijado && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                          <Pin className="w-3 h-3" />
                          Destacado
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {comunicado.categoria?.nombre}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                        <Calendar className="w-4 h-4" />
                        {formatearFecha(comunicado.fecha_publicacion || comunicado.fecha_creacion)}
                      </span>
                    </div>

                    {/* Título */}
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {comunicado.titulo}
                    </h2>

                    {/* Extracto */}
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {extraerTextoPlano(comunicado.contenido_html, 200)}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {comunicado.creador?.imagen_perfil_url ? (
                          <img
                            src={comunicado.creador.imagen_perfil_url}
                            alt={comunicado.creador.nombre}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-600 text-xs font-medium">
                              {comunicado.creador?.nombre[0]}{comunicado.creador?.apellidos[0]}
                            </span>
                          </div>
                        )}
                        <div className="text-sm">
                          <p className="text-gray-700 font-medium">
                            {comunicado.creador?.nombre} {comunicado.creador?.apellidos}
                          </p>
                        </div>
                      </div>

                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 group">
                        Leer más
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-4">
              {loadingMore && (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              {!hasMore && comunicados.length > 0 && (
                <p className="text-center text-gray-500 text-sm">
                  No hay más comunicados por mostrar
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
