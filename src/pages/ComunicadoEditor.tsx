import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, Upload, X, Calendar, Pin, Image, Paperclip, Eye } from 'lucide-react';
import {
  obtenerComunicadoPorId,
  crearComunicado,
  actualizarComunicado,
  obtenerCategoriasActivas,
  subirImagenComunicado,
  subirAdjuntoComunicado,
  agregarAdjunto,
  eliminarAdjunto,
  establecerVisibilidad
} from '../lib/comunicadosUtils';
import type { ComunicadoCategoria } from '../lib/comunicadosTypes';

export default function ComunicadoEditor() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<ComunicadoCategoria[]>([]);

  const [titulo, setTitulo] = useState('');
  const [contenidoHtml, setContenidoHtml] = useState('');
  const [imagenPrincipal, setImagenPrincipal] = useState<File | null>(null);
  const [imagenPrincipalUrl, setImagenPrincipalUrl] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [publicarAhora, setPublicarAhora] = useState(true);
  const [fechaPublicacion, setFechaPublicacion] = useState('');
  const [fijado, setFijado] = useState(false);
  const [adjuntos, setAdjuntos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const esAdmin = usuario?.rol === 'Administrador';
  const esEdicion = !!id;

  useEffect(() => {
    if (!esAdmin) {
      navigate('/comunicados');
      return;
    }

    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      const categoriasData = await obtenerCategoriasActivas();
      setCategorias(categoriasData);

      if (categoriasData.length > 0 && !categoriaId) {
        setCategoriaId(categoriasData[0].id);
      }

      if (id) {
        const comunicado = await obtenerComunicadoPorId(id);
        if (comunicado) {
          setTitulo(comunicado.titulo);
          setContenidoHtml(comunicado.contenido_html);
          setImagenPrincipalUrl(comunicado.imagen_principal);
          setCategoriaId(comunicado.categoria_id);
          setFijado(comunicado.fijado);

          if (comunicado.fecha_publicacion) {
            const fecha = new Date(comunicado.fecha_publicacion);
            const fechaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setFechaPublicacion(fechaLocal);
            setPublicarAhora(false);
          }
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImagenPrincipal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImagenPrincipal(file);
      setImagenPrincipalUrl(URL.createObjectURL(file));
    }
  };

  const handleAdjuntos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const nuevosAdjuntos = Array.from(e.target.files);
      if (adjuntos.length + nuevosAdjuntos.length > 5) {
        alert('Máximo 5 adjuntos permitidos');
        return;
      }
      setAdjuntos([...adjuntos, ...nuevosAdjuntos]);
    }
  };

  const eliminarAdjuntoLocal = (index: number) => {
    setAdjuntos(adjuntos.filter((_, i) => i !== index));
  };

  const handleGuardar = async () => {
    if (!titulo.trim()) {
      alert('El título es obligatorio');
      return;
    }

    if (!contenidoHtml.trim()) {
      alert('El contenido es obligatorio');
      return;
    }

    if (!imagenPrincipal && !imagenPrincipalUrl) {
      alert('La imagen principal es obligatoria');
      return;
    }

    if (!categoriaId) {
      alert('Debes seleccionar una categoría');
      return;
    }

    try {
      setSaving(true);

      let urlImagen = imagenPrincipalUrl;

      if (imagenPrincipal) {
        urlImagen = await subirImagenComunicado(imagenPrincipal);
      }

      const fechaPub = publicarAhora
        ? new Date().toISOString()
        : new Date(fechaPublicacion).toISOString();

      const datosComunicado = {
        titulo,
        contenido_html: contenidoHtml,
        imagen_principal: urlImagen,
        categoria_id: categoriaId,
        fecha_publicacion: fechaPub,
        publicado: true,
        fijado,
        creado_por: usuario!.id
      };

      let comunicadoId = id;

      if (esEdicion) {
        await actualizarComunicado(id!, datosComunicado);
      } else {
        const nuevoComunicado = await crearComunicado(datosComunicado);
        comunicadoId = nuevoComunicado.id;
      }

      // Subir adjuntos
      if (adjuntos.length > 0 && comunicadoId) {
        for (const adjunto of adjuntos) {
          const urlAdjunto = await subirAdjuntoComunicado(adjunto);
          await agregarAdjunto({
            comunicado_id: comunicadoId,
            archivo_url: urlAdjunto,
            nombre_archivo: adjunto.name,
            tamanio_bytes: adjunto.size,
            tipo_mime: adjunto.type
          });
        }
      }

      alert(esEdicion ? 'Comunicado actualizado exitosamente' : 'Comunicado creado exitosamente');
      navigate('/comunicados');
    } catch (error) {
      console.error('Error guardando comunicado:', error);
      alert('Error al guardar el comunicado');
    } finally {
      setSaving(false);
    }
  };

  if (!esAdmin) {
    return null;
  }

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
      <div className="max-w-4xl mx-auto">
        {/* Navegación */}
        <button
          onClick={() => navigate('/comunicados')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Formulario */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Título */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Escribe un título atractivo..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Imagen Principal */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Imagen Principal *
            </label>
            {imagenPrincipalUrl ? (
              <div className="relative">
                <img
                  src={imagenPrincipalUrl}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setImagenPrincipal(null);
                    setImagenPrincipalUrl('');
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                <Upload className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-gray-600">Click para subir imagen</span>
                <span className="text-gray-400 text-sm mt-1">JPG, PNG o WEBP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagenPrincipal}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Contenido HTML */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contenido *
            </label>
            <textarea
              value={contenidoHtml}
              onChange={(e) => setContenidoHtml(e.target.value)}
              placeholder="Escribe el contenido del comunicado (puedes usar HTML básico)..."
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              Puedes usar HTML: &lt;p&gt;, &lt;h1&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, etc.
            </p>
          </div>

          {/* Adjuntos */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Archivos Adjuntos (máximo 5)
            </label>
            <label className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition w-fit">
              <Paperclip className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700">Agregar archivos</span>
              <input
                type="file"
                multiple
                onChange={handleAdjuntos}
                className="hidden"
                disabled={adjuntos.length >= 5}
              />
            </label>

            {adjuntos.length > 0 && (
              <div className="mt-3 space-y-2">
                {adjuntos.map((adjunto, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm text-gray-700">{adjunto.name}</span>
                    <button
                      onClick={() => eliminarAdjuntoLocal(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opciones de Publicación */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Opciones de Publicación
            </h3>

            <div className="space-y-4">
              {/* Publicar ahora o programar */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={publicarAhora}
                    onChange={() => setPublicarAhora(true)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">Publicar ahora</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!publicarAhora}
                    onChange={() => setPublicarAhora(false)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700">Programar publicación</span>
                </label>
              </div>

              {!publicarAhora && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha y hora de publicación
                  </label>
                  <input
                    type="datetime-local"
                    value={fechaPublicacion}
                    onChange={(e) => setFechaPublicacion(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Fijar comunicado */}
              <label className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={fijado}
                  onChange={(e) => setFijado(e.target.checked)}
                  className="w-5 h-5 text-amber-600"
                />
                <div className="flex items-center gap-2">
                  <Pin className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-gray-900">Fijar comunicado</span>
                </div>
                <span className="text-sm text-gray-600 ml-auto">
                  Se mostrará siempre arriba
                </span>
              </label>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-3 pt-6 border-t">
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Publicar'}
            </button>

            <button
              onClick={() => navigate('/comunicados')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
