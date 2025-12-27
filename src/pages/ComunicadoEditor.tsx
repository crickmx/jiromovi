import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Container } from '../components/ui/container';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { RichTextEditor } from '../components/RichTextEditor';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, Upload, X, Calendar, Pin, Image, Paperclip, Eye, Users, Building2, User, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
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

  // Estados de visibilidad
  const [tipoVisibilidad, setTipoVisibilidad] = useState<'todos' | 'rol' | 'oficina'>('todos');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const [oficinasSeleccionadas, setOficinasSeleccionadas] = useState<string[]>([]);
  const [oficinasDisponibles, setOficinasDisponibles] = useState<any[]>([]);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const puedeCrear = esAdmin || esGerente;
  const esEdicion = !!id;

  // Validar que Gerentes tengan oficina asignada
  const gerenteSinOficina = esGerente && !usuario?.oficina_id;

  useEffect(() => {
    if (!puedeCrear) {
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

      // Cargar oficinas disponibles
      const { data: oficinasData } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');
      setOficinasDisponibles(oficinasData || []);

      if (categoriasData.length > 0 && !categoriaId) {
        setCategoriaId(categoriasData[0].id);
      }

      if (id) {
        const comunicado = await obtenerComunicadoPorId(id);
        if (comunicado) {
          // Verificar que Gerentes solo editen sus propios comunicados
          if (esGerente && comunicado.creado_por !== usuario?.id) {
            alert('No tienes permiso para editar este comunicado');
            navigate('/comunicados');
            return;
          }

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

    // Validación específica para Gerentes
    if (esGerente && rolesSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un destinatario (Empleados y/o Agentes)');
      return;
    }

    // Validar visibilidad para Administradores
    // Validación para Gerentes
    if (esGerente) {
      if (!usuario?.oficina_id) {
        alert('No tienes una oficina asignada. Contacta al administrador.');
        return;
      }

      if (rolesSeleccionados.length === 0) {
        alert('Debes seleccionar al menos un rol (Empleado o Agente)');
        return;
      }
    }

    if (esAdmin) {
      if (tipoVisibilidad === 'rol' && rolesSeleccionados.length === 0) {
        alert('Debes seleccionar al menos un rol');
        return;
      }

      if (tipoVisibilidad === 'oficina' && oficinasSeleccionadas.length === 0) {
        alert('Debes seleccionar al menos una oficina');
        return;
      }
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
        fijado: esGerente ? false : fijado, // Gerentes no pueden fijar
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

      // Establecer visibilidad
      if (comunicadoId) {
        // Eliminar visibilidad anterior si existe (para edición)
        await supabase
          .from('comunicados_visibilidad')
          .delete()
          .eq('comunicado_id', comunicadoId);

        const reglasVisibilidad = [];

        // Lógica especial para Gerentes
        if (esGerente) {
          // Gerentes: crear visibilidad para roles seleccionados de SU OFICINA
          const oficinaGerente = usuario?.oficina_id;

          for (const rol of rolesSeleccionados) {
            reglasVisibilidad.push({
              comunicado_id: comunicadoId,
              rol: rol,
              oficina_id: oficinaGerente,
              usuario_id: null,
              para_todos: false
            });
          }

          // Los administradores verán automáticamente todas las publicaciones
          // (esto se maneja en las políticas RLS y función puede_ver_comunicado)
        }
        // Lógica para Administradores
        else if (esAdmin) {
          if (tipoVisibilidad === 'todos') {
            // Visible para todos
            reglasVisibilidad.push({
              comunicado_id: comunicadoId,
              rol: null,
              oficina_id: null,
              usuario_id: null,
              para_todos: true
            });
          } else if (tipoVisibilidad === 'rol') {
            for (const rol of rolesSeleccionados) {
              reglasVisibilidad.push({
                comunicado_id: comunicadoId,
                rol: rol,
                oficina_id: null,
                usuario_id: null,
                para_todos: false
              });
            }
          } else if (tipoVisibilidad === 'oficina') {
            for (const oficinaId of oficinasSeleccionadas) {
              reglasVisibilidad.push({
                comunicado_id: comunicadoId,
                rol: null,
                oficina_id: oficinaId,
                usuario_id: null,
                para_todos: false
              });
            }
          }
        }

        if (reglasVisibilidad.length > 0) {
          await supabase
            .from('comunicados_visibilidad')
            .insert(reglasVisibilidad);
        }
      }

      // Enviar notificaciones si es nuevo comunicado
      if (!esEdicion && comunicadoId) {
        try {
          // Obtener destinatarios según las reglas de visibilidad
          let destinatarios: string[] = [];

          if (esGerente) {
            // Para gerentes: notificar a usuarios de su oficina según roles seleccionados
            const { data: usuariosOficina } = await supabase
              .from('usuarios')
              .select('id')
              .eq('oficina_id', usuario?.oficina_id)
              .in('rol', rolesSeleccionados)
              .eq('estado', 'activo');

            if (usuariosOficina) {
              destinatarios = usuariosOficina.map(u => u.id);
            }

            // Agregar administradores
            const { data: admins } = await supabase
              .from('usuarios')
              .select('id')
              .eq('rol', 'Administrador')
              .eq('estado', 'activo');

            if (admins) {
              destinatarios.push(...admins.map(a => a.id));
            }
          } else if (esAdmin) {
            // Para administradores: notificar según configuración de visibilidad
            if (tipoVisibilidad === 'todos') {
              const { data: todosUsuarios } = await supabase
                .from('usuarios')
                .select('id')
                .eq('estado', 'activo');

              if (todosUsuarios) {
                destinatarios = todosUsuarios.map(u => u.id);
              }
            } else if (tipoVisibilidad === 'rol') {
              const { data: usuariosPorRol } = await supabase
                .from('usuarios')
                .select('id')
                .in('rol', rolesSeleccionados)
                .eq('estado', 'activo');

              if (usuariosPorRol) {
                destinatarios = usuariosPorRol.map(u => u.id);
              }
            } else if (tipoVisibilidad === 'oficina') {
              const { data: usuariosPorOficina } = await supabase
                .from('usuarios')
                .select('id')
                .in('oficina_id', oficinasSeleccionadas)
                .eq('estado', 'activo');

              if (usuariosPorOficina) {
                destinatarios = usuariosPorOficina.map(u => u.id);
              }
            }
          }

          // Eliminar duplicados
          destinatarios = [...new Set(destinatarios)];

          if (destinatarios.length > 0) {
            const linkComunicado = `${window.location.origin}/comunicados/${comunicadoId}`;

            // Usar el nuevo motor centralizado de notificaciones
            const { data: result, error: notifyError } = await supabase.rpc('notify', {
              p_event_code: 'nuevo_comunicado',
              p_user_ids: destinatarios,
              p_payload: {
                titulo_comunicado: titulo,
                link_comunicado: linkComunicado,
                categoria: categoriaId ? categoriaId : 'General',
                modulo: 'Comunicados'
              },
              p_entity_id: comunicadoId
            });

            if (notifyError) {
              console.error('Error al crear jobs de notificación:', notifyError);
            } else {
              console.log('Notificaciones programadas:', result);
            }

            // Ejecutar dispatcher inmediatamente (sin esperar respuesta)
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notification-dispatcher`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              }
            }).catch(err => console.warn('Dispatcher no pudo ejecutarse:', err));
          }
        } catch (error) {
          console.error('Error enviando notificaciones:', error);
          // No bloqueamos el flujo si fallan las notificaciones
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

  if (!puedeCrear) {
    return null;
  }

  if (gerenteSinOficina) {
    return (
      <Layout hideHeader>
        <Container size="lg">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 md:p-12 text-center shadow-ios">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-3">
              Oficina no asignada
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mb-6 max-w-md mx-auto">
              Para crear comunicados necesitas tener una oficina asignada. Por favor contacta al administrador del sistema.
            </p>
            <Button onClick={() => navigate('/comunicados')}>
              Volver a Comunicados
            </Button>
          </div>
        </Container>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout hideHeader>
        <Container size="lg">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-primary-500 border-t-transparent"></div>
          </div>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout hideHeader>
      <Container size="lg">
        {/* Navegación */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/comunicados')}
            className="btn-touch"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-ios p-4 sm:p-6 md:p-8 space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo" className="text-sm sm:text-base">
              Título *
            </Label>
            <Input
              id="titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Escribe un título atractivo..."
              className="text-base sm:text-lg py-3"
            />
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="categoria" className="text-sm sm:text-base">
              Categoría *
            </Label>
            <select
              id="categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-base text-sm sm:text-base bg-white"
            >
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Imagen Principal */}
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">
              Imagen Principal *
            </Label>
            {imagenPrincipalUrl ? (
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={imagenPrincipalUrl}
                  alt="Preview"
                  className="w-full h-48 sm:h-64 md:h-80 object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImagenPrincipal(null);
                    setImagenPrincipalUrl('');
                  }}
                  className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm hover:bg-white text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed border-neutral-300 rounded-lg cursor-pointer hover:border-primary-500 active:border-primary-600 transition-colors bg-neutral-50 hover:bg-neutral-100 btn-touch">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-neutral-400 mb-2" />
                <span className="text-sm sm:text-base text-neutral-600 font-medium">Click para subir imagen</span>
                <span className="text-xs sm:text-sm text-neutral-400 mt-1">JPG, PNG o WEBP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagenPrincipal}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Contenido */}
          <div className="space-y-2">
            <Label htmlFor="contenido" className="text-sm sm:text-base">
              Contenido *
            </Label>
            <RichTextEditor
              value={contenidoHtml}
              onChange={setContenidoHtml}
              placeholder="Escribe el contenido del comunicado..."
              minHeight="300px"
            />
          </div>

          {/* Adjuntos */}
          <div className="space-y-3">
            <Label className="text-sm sm:text-base">
              Archivos Adjuntos (máximo 5)
            </Label>
            <label className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors btn-touch">
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600" />
              <span className="text-sm sm:text-base text-neutral-700 font-medium">Agregar archivos</span>
              <input
                type="file"
                multiple
                onChange={handleAdjuntos}
                className="hidden"
                disabled={adjuntos.length >= 5}
              />
            </label>

            {adjuntos.length > 0 && (
              <div className="space-y-2">
                {adjuntos.map((adjunto, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                  >
                    <span className="text-xs sm:text-sm text-neutral-700 truncate flex-1 mr-2">{adjunto.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarAdjuntoLocal(index)}
                      className="text-red-600 hover:text-red-700 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
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
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="text-gray-700">Publicar ahora</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!publicarAhora}
                    onChange={() => setPublicarAhora(false)}
                    className="w-4 h-4 text-primary-600"
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

              {/* Fijar comunicado - Solo Administradores */}
              {esAdmin && (
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
              )}
            </div>
          </div>

          {/* Control de Visibilidad */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Control de Visibilidad
            </h3>

            {/* UI especial para Gerentes */}
            {esGerente && (
              <div className="space-y-4">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ¿A quién deseas mostrar este comunicado?
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Este comunicado será visible para los roles seleccionados de tu oficina.
                    Los Administradores siempre podrán verlo.
                  </p>
                  <div className="space-y-2">
                    {['Empleado', 'Agente'].map((rol) => (
                      <label key={rol} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rolesSeleccionados.includes(rol)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRolesSeleccionados([...rolesSeleccionados, rol]);
                            } else {
                              setRolesSeleccionados(rolesSeleccionados.filter(r => r !== rol));
                            }
                          }}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-gray-700">{rol}s de mi oficina</span>
                      </label>
                    ))}
                  </div>
                  {rolesSeleccionados.length === 0 && (
                    <p className="text-sm text-amber-600 mt-3">
                      Debes seleccionar al menos un destinatario
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* UI completa para Administradores */}
            {esAdmin && (
              <div className="space-y-4">
                {/* Tipo de visibilidad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ¿Quién puede ver este comunicado?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        checked={tipoVisibilidad === 'todos'}
                        onChange={() => setTipoVisibilidad('todos')}
                        className="w-4 h-4 text-primary-600"
                      />
                      <Users className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">Todos los usuarios</div>
                        <div className="text-sm text-gray-500">Visible para toda la organización</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        checked={tipoVisibilidad === 'rol'}
                        onChange={() => setTipoVisibilidad('rol')}
                        className="w-4 h-4 text-primary-600"
                      />
                      <User className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">Por roles</div>
                        <div className="text-sm text-gray-500">Visible solo para roles específicos</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        checked={tipoVisibilidad === 'oficina'}
                        onChange={() => setTipoVisibilidad('oficina')}
                        className="w-4 h-4 text-primary-600"
                      />
                      <Building2 className="w-5 h-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">Por oficinas</div>
                        <div className="text-sm text-gray-500">Visible solo para oficinas específicas</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selector de roles */}
                {tipoVisibilidad === 'rol' && (
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Selecciona los roles que pueden ver este comunicado:
                    </label>
                    <div className="space-y-2">
                      {['Administrador', 'Gerente', 'Empleado', 'Agente'].map((rol) => (
                        <label key={rol} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rolesSeleccionados.includes(rol)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setRolesSeleccionados([...rolesSeleccionados, rol]);
                              } else {
                                setRolesSeleccionados(rolesSeleccionados.filter(r => r !== rol));
                              }
                            }}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-gray-700">{rol}</span>
                        </label>
                      ))}
                    </div>
                    {rolesSeleccionados.length === 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        Debes seleccionar al menos un rol
                      </p>
                    )}
                  </div>
                )}

                {/* Selector de oficinas */}
                {tipoVisibilidad === 'oficina' && (
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Selecciona las oficinas que pueden ver este comunicado:
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {oficinasDisponibles.map((oficina) => (
                        <label key={oficina.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={oficinasSeleccionadas.includes(oficina.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setOficinasSeleccionadas([...oficinasSeleccionadas, oficina.id]);
                              } else {
                                setOficinasSeleccionadas(oficinasSeleccionadas.filter(o => o !== oficina.id));
                              }
                            }}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-gray-700">{oficina.nombre}</span>
                        </label>
                      ))}
                    </div>
                    {oficinasSeleccionadas.length === 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        Debes seleccionar al menos una oficina
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 border-t border-neutral-200">
            <Button
              type="button"
              onClick={handleGuardar}
              disabled={saving}
              className="btn-touch flex-1 sm:flex-initial order-2 sm:order-1"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              {saving ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Publicar'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/comunicados')}
              className="btn-touch flex-1 sm:flex-initial order-1 sm:order-2"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Container>
    </Layout>
  );
}
