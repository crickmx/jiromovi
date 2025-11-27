import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Calendar, Pin, FileText, Settings, Filter, X } from 'lucide-react';
import { obtenerComunicados, obtenerCategoriasActivas } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion, ComunicadoCategoria } from '../lib/comunicadosTypes';
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

  // Estados de filtros
  const [categorias, setCategorias] = useState<ComunicadoCategoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const puedeCrear = esAdmin || esGerente;
  const ITEMS_PER_PAGE = 10;

  // Cargar categorías
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const data = await obtenerCategoriasActivas();
        setCategorias(data);
      } catch (error) {
        console.error('Error cargando categorías:', error);
      }
    };
    cargarCategorias();
  }, []);

  const cargarComunicados = useCallback(async (pageNum: number) => {
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const offset = pageNum * ITEMS_PER_PAGE;
      const data = await obtenerComunicados(
        ITEMS_PER_PAGE,
        offset,
        categoriaSeleccionada || undefined,
        fechaDesde || undefined,
        fechaHasta || undefined
      );

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
  }, [categoriaSeleccionada, fechaDesde, fechaHasta]);

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

  const aplicarFiltros = () => {
    setPage(0);
    setHasMore(true);
    cargarComunicados(0);
  };

  const limpiarFiltros = () => {
    setCategoriaSeleccionada('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(0);
    setHasMore(true);
  };

  const hayFiltrosActivos = categoriaSeleccionada || fechaDesde || fechaHasta;

  if (loading) {
    return (
      <Layout hideHeader>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideHeader>
      <div className="max-w-5xl mx-auto">
        {/* Botones de acción */}
        {puedeCrear && (
          <div className="flex items-center gap-3 mb-4 justify-end">
            {esAdmin && (
              <button
                onClick={() => navigate('/comunicados/categorias')}
                className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">Categorías</span>
              </button>
            )}
            <button
              onClick={() => navigate('/comunicados/nuevo')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Nuevo Comunicado
            </button>
          </div>
        )}

        {/* Barra de filtros */}
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filtros</h3>
              {hayFiltrosActivos && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Activos
                </span>
              )}
            </div>
            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {mostrarFiltros ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {mostrarFiltros && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Filtro de Categoría */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoría
                  </label>
                  <select
                    value={categoriaSeleccionada}
                    onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Fecha Desde */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Filtro Fecha Hasta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-3 justify-end pt-2">
                {hayFiltrosActivos && (
                  <button
                    onClick={limpiarFiltros}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpiar filtros
                  </button>
                )}
                <button
                  onClick={aplicarFiltros}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

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
            {comunicados.map((comunicado) => {
              // Verificar si fue creado por gerente (tiene oficina_origen_id)
              const esDeGerente = !!comunicado.oficina_origen_id;

              return (
                <article
                  key={comunicado.id}
                  className={`bg-white rounded-xl border ${
                    esDeGerente
                      ? 'border-l-4 border-l-[#1D78FF] border-t-gray-200 border-r-gray-200 border-b-gray-200'
                      : 'border-gray-200'
                  } shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer`}
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
                      {esDeGerente && comunicado.oficina_origen && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold border border-blue-300">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          {comunicado.oficina_origen.nombre}
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
                    <div className="flex items-center justify-end">
                      <button className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 group">
                        Leer más
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}

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
