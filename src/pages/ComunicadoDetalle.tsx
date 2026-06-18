import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Container } from '../components/ui/container';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Download, Pin, CreditCard as Edit, Trash2, FileText, Newspaper } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { obtenerComunicadoPorId, eliminarComunicado, verificarVisibilidad } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';
import { formatearFechaHora } from '../lib/comunicadosUtils';
import { cn } from '@/lib/utils';

export default function ComunicadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [comunicado, setComunicado] = useState<ComunicadoPublicacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [puedeVer, setPuedeVer] = useState(true);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';

  useEffect(() => {
    cargarComunicado();
  }, [id]);

  const cargarComunicado = async () => {
    if (!id || !usuario) return;

    try {
      setLoading(true);
      const data = await obtenerComunicadoPorId(id);

      if (!data) {
        setPuedeVer(false);
        return;
      }

      // Verificar visibilidad
      const tieneAcceso = await verificarVisibilidad(id, usuario.id);

      if (!tieneAcceso && !esAdmin) {
        setPuedeVer(false);
        return;
      }

      setComunicado(data);
    } catch (error) {
      console.error('Error cargando comunicado:', error);
      setPuedeVer(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async () => {
    if (!comunicado || !confirm('¿Estás seguro de eliminar este comunicado?')) return;

    try {
      await eliminarComunicado(comunicado.id);
      navigate('/comunicados');
    } catch (error) {
      console.error('Error eliminando comunicado:', error);
      alert('Error al eliminar el comunicado');
    }
  };

  if (loading) {
    return (
      <>
        <Container size="lg">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-accent border-t-transparent"></div>
          </div>
        </Container>
      </>
    );
  }

  if (!puedeVer) {
    return (
      <>
        <Container size="lg">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-ios p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">
              Acceso Denegado
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mb-6">
              No tienes permiso para ver este comunicado.
            </p>
            <Button onClick={() => navigate('/comunicados')}>
              Volver a Comunicados
            </Button>
          </div>
        </Container>
      </>
    );
  }

  if (!comunicado) {
    return (
      <>
        <Container size="lg">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-ios p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">
              Comunicado no encontrado
            </h2>
            <Button onClick={() => navigate('/comunicados')}>
              Volver a Comunicados
            </Button>
          </div>
        </Container>
      </>
    );
  }

  const esDeGerente = !!comunicado.oficina_origen_id;
  const puedeEditar = esAdmin || (esGerente && comunicado.creado_por === usuario?.id);

  return (
    <>
      <Container size="lg">
        {/* Navegación y acciones */}
        <PageHeader
          title={comunicado.titulo}
          icon={Newspaper}
          backTo="/comunicados"
          backLabel="Volver"
          actions={
            puedeEditar ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/comunicados/editar/${comunicado.id}`)}
                  className="btn-touch flex-1 sm:flex-initial"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEliminar}
                  className="btn-touch flex-1 sm:flex-initial text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            ) : undefined
          }
          className="mb-4 sm:mb-6"
        />

        {/* Artículo */}
        <article
          className={cn(
            "bg-white rounded-xl border shadow-ios overflow-hidden",
            esDeGerente
              ? "border-l-4 border-l-primary-500 border-t-neutral-200 border-r-neutral-200 border-b-neutral-200"
              : "border-neutral-200"
          )}
        >
          {/* Imagen principal */}
          <div className="w-full h-48 sm:h-64 md:h-96 overflow-hidden bg-neutral-100">
            <img
              src={comunicado.imagen_principal}
              alt={comunicado.titulo}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          <div className="p-4 sm:p-6 md:p-8">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {comunicado.fijado && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs sm:text-sm font-semibold">
                  <Pin className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Destacado</span>
                </span>
              )}
              {esDeGerente && comunicado.oficina_origen && (
                <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-xs sm:text-sm font-semibold">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <span className="hidden sm:inline">{comunicado.oficina_origen.nombre}</span>
                </span>
              )}
              {comunicado.categoria && (
                <span className="inline-flex items-center px-2 sm:px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs sm:text-sm font-medium">
                  {comunicado.categoria.nombre}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-neutral-500 text-xs sm:text-sm ml-auto">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">
                  {formatearFechaHora(comunicado.fecha_publicacion || comunicado.fecha_creacion)}
                </span>
                <span className="sm:hidden">
                  {new Date(comunicado.fecha_publicacion || comunicado.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </span>
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 mb-6 sm:mb-8 leading-tight">
              {comunicado.titulo}
            </h1>

            {/* Contenido HTML */}
            <div
              className="prose prose-neutral max-w-none mb-6 sm:mb-8
                prose-headings:font-bold prose-headings:text-neutral-900
                prose-h1:text-2xl sm:prose-h1:text-3xl prose-h1:mb-4
                prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:mb-3
                prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mb-2
                prose-p:text-sm sm:prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-accent hover:prose-a:text-primary-700
                prose-strong:text-neutral-900 prose-strong:font-semibold
                prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
                prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
                prose-li:text-sm sm:prose-li:text-base prose-li:mb-2
                prose-img:rounded-lg prose-img:shadow-sm prose-img:my-6
                prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:pl-4 prose-blockquote:italic
                prose-code:text-accent prose-code:bg-primary-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: comunicado.contenido_html }}
            />

            {/* Adjuntos */}
            {comunicado.adjuntos && comunicado.adjuntos.length > 0 && (
              <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-neutral-200">
                <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  Archivos Adjuntos
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {comunicado.adjuntos.map((adjunto) => (
                    <a
                      key={adjunto.id}
                      href={adjunto.archivo_url}
                      download={adjunto.nombre_archivo}
                      className="flex items-center justify-between p-3 sm:p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 active:bg-neutral-200 transition-colors group btn-touch"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-900 text-sm sm:text-base truncate">
                            {adjunto.nombre_archivo}
                          </p>
                          {adjunto.tamanio_bytes && (
                            <p className="text-xs sm:text-sm text-neutral-500">
                              {(adjunto.tamanio_bytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      </div>
                      <Download className="w-5 h-5 text-neutral-400 group-hover:text-accent transition-colors flex-shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </Container>
    </>
  );
}
