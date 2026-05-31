import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Pin, FileText, Settings, ListFilter as Filter, X, ChevronRight } from 'lucide-react';
import { obtenerComunicados, obtenerCategoriasActivas } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion, ComunicadoCategoria } from '../lib/comunicadosTypes';
import { extraerTextoPlano, formatearFecha } from '../lib/comunicadosUtils';
import { cn } from '@/lib/utils';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import { trackAnnouncementListViewed, trackAnnouncementOpened } from '../lib/activityLogger';

export default function Comunicados() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [comunicados, setComunicados] = useState<ComunicadoPublicacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [categorias, setCategorias] = useState<ComunicadoCategoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const esAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.COMUNICADOS);
  const esGerente = usuario?.rol === 'Gerente';
  const puedeCrear = esAdmin || esGerente;
  const ITEMS_PER_PAGE = 10;

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
    trackAnnouncementListViewed();
    cargarComunicados(0);
  }, [cargarComunicados]);

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
      <>
        <div className="space-y-4">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Comunicados"
          description="Mantente informado con las últimas noticias y anuncios de la organización"
          icon={FileText}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {esAdmin && (
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => navigate('/comunicados/categorias')}
                  className="btn-touch"
                >
                  <Settings className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Categorías</span>
                </Button>
              )}
              {puedeCrear && (
                <Button
                  size="default"
                  onClick={() => navigate('/comunicados/nuevo')}
                  className="btn-touch"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo
                </Button>
              )}
            </div>
          }
        />

        <div className="mt-6 space-y-6">
          {/* Sección de filtros */}
          <Section variant="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-neutral-600" />
                <h3 className="font-semibold text-neutral-900">Filtros</h3>
                {hayFiltrosActivos && (
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                    Activos
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
              >
                {mostrarFiltros ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>

            {mostrarFiltros && (
              <div className="mt-4 pt-4 border-t border-neutral-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Filtro de Categoría */}
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría</Label>
                    <select
                      id="categoria"
                      value={categoriaSeleccionada}
                      onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-base text-sm bg-white"
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
                  <div className="space-y-2">
                    <Label htmlFor="fecha-desde">Desde</Label>
                    <Input
                      id="fecha-desde"
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                    />
                  </div>

                  {/* Filtro Fecha Hasta */}
                  <div className="space-y-2">
                    <Label htmlFor="fecha-hasta">Hasta</Label>
                    <Input
                      id="fecha-hasta"
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                    />
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end pt-2">
                  {hayFiltrosActivos && (
                    <Button
                      variant="ghost"
                      onClick={limpiarFiltros}
                      className="btn-touch"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpiar
                    </Button>
                  )}
                  <Button
                    onClick={aplicarFiltros}
                    className="btn-touch"
                  >
                    Aplicar Filtros
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* Lista de comunicados */}
          {comunicados.length === 0 ? (
            <Section variant="card">
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  No hay comunicados
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  {puedeCrear
                    ? 'Comienza creando tu primer comunicado'
                    : 'Pronto habrá novedades que compartir'}
                </p>
                {puedeCrear && (
                  <Button onClick={() => navigate('/comunicados/nuevo')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Comunicado
                  </Button>
                )}
              </div>
            </Section>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {comunicados.map((comunicado) => {
                  const esDeGerente = !!comunicado.oficina_origen_id;

                  return (
                    <article
                      key={comunicado.id}
                      className={cn(
                        "bg-white rounded-lg border shadow-ios overflow-hidden",
                        "transition-all duration-200 hover:shadow-ios-md cursor-pointer group",
                        "flex flex-col h-full",
                        esDeGerente
                          ? "border-t-4 border-t-primary-500 border-l-neutral-200 border-r-neutral-200 border-b-neutral-200"
                          : "border-neutral-200 hover:border-primary-300"
                      )}
                      onClick={() => {
                        trackAnnouncementOpened(comunicado.titulo, comunicado.id);
                        navigate(`/comunicados/${comunicado.id}`);
                      }}
                    >
                      {/* Imagen */}
                      <div className="w-full h-48 overflow-hidden bg-neutral-100">
                        <img
                          src={comunicado.imagen_principal}
                          alt={comunicado.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>

                      {/* Contenido */}
                      <div className="flex flex-col flex-1 p-4">
                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {comunicado.fijado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                              <Pin className="w-3 h-3" />
                              <span className="hidden sm:inline">Destacado</span>
                            </span>
                          )}
                          {esDeGerente && comunicado.oficina_origen && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs font-semibold">
                              <div className="w-2 h-2 bg-accent rounded-full"></div>
                              <span className="hidden sm:inline">{comunicado.oficina_origen.nombre}</span>
                            </span>
                          )}
                          {comunicado.categoria && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                              {comunicado.categoria.nombre}
                            </span>
                          )}
                        </div>

                        {/* Título */}
                        <h2 className="text-lg font-bold text-neutral-900 mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                          {comunicado.titulo}
                        </h2>

                        {/* Extracto */}
                        <p className="text-sm text-neutral-600 mb-4 line-clamp-3 leading-relaxed flex-1">
                          {extraerTextoPlano(comunicado.contenido_html, 150)}
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                          <span className="inline-flex items-center gap-1 text-neutral-500 text-xs">
                            <Calendar className="w-3 h-3" />
                            {new Date(comunicado.fecha_publicacion || comunicado.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-accent group-hover:text-primary-700 font-medium text-sm flex items-center gap-1 transition-colors">
                            Leer más
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="py-6">
                {loadingMore && (
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!hasMore && comunicados.length > 0 && (
                  <p className="text-center text-neutral-500 text-sm">
                    No hay más comunicados por mostrar
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
