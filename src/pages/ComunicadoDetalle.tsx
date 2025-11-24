import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Calendar, Download, Pin, Edit, Trash2, FileText } from 'lucide-react';
import { obtenerComunicadoPorId, eliminarComunicado, verificarVisibilidad } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';
import { formatearFechaHora } from '../lib/comunicadosUtils';

export default function ComunicadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [comunicado, setComunicado] = useState<ComunicadoPublicacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [puedeVer, setPuedeVer] = useState(true);

  const esAdmin = usuario?.rol === 'Administrador';

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
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (!puedeVer) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acceso Denegado
            </h2>
            <p className="text-gray-600 mb-6">
              No tienes permiso para ver este comunicado.
            </p>
            <button
              onClick={() => navigate('/comunicados')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Volver a Comunicados
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!comunicado) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Comunicado no encontrado
            </h2>
            <button
              onClick={() => navigate('/comunicados')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Volver a Comunicados
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Navegación y acciones */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/comunicados')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          {esAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/comunicados/editar/${comunicado.id}`)}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Edit className="w-3.5 h-3.5" />
                Editar
              </button>
              <button
                onClick={handleEliminar}
                className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Artículo */}
        <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Imagen principal */}
          <div className="w-full h-64 sm:h-96 overflow-hidden">
            <img
              src={comunicado.imagen_principal}
              alt={comunicado.titulo}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 sm:p-8">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {comunicado.fijado && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                  <Pin className="w-4 h-4" />
                  Destacado
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                {comunicado.categoria?.nombre}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                <Calendar className="w-4 h-4" />
                {formatearFechaHora(comunicado.fecha_publicacion || comunicado.fecha_creacion)}
              </span>
            </div>

            {/* Título */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
              {comunicado.titulo}
            </h1>

            {/* Contenido HTML */}
            <div
              className="prose prose-blue max-w-none mb-8"
              dangerouslySetInnerHTML={{ __html: comunicado.contenido_html }}
            />

            {/* Adjuntos */}
            {comunicado.adjuntos && comunicado.adjuntos.length > 0 && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Archivos Adjuntos
                </h3>
                <div className="space-y-3">
                  {comunicado.adjuntos.map((adjunto) => (
                    <a
                      key={adjunto.id}
                      href={adjunto.archivo_url}
                      download={adjunto.nombre_archivo}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{adjunto.nombre_archivo}</p>
                          {adjunto.tamanio_bytes && (
                            <p className="text-sm text-gray-500">
                              {(adjunto.tamanio_bytes / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      </div>
                      <Download className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </div>
    </Layout>
  );
}
