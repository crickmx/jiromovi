import { useState, useEffect } from 'react';
import { X, Flag, User, Search, Paperclip, Upload, Download, Trash2, FileText, CircleUser as UserCircle } from 'lucide-react';
import {
  crearTarea,
  actualizarTarea,
  obtenerContactos,
  obtenerAdjuntosTarea,
  subirAdjuntoTarea,
  eliminarAdjuntoTarea,
  descargarAdjuntoTarea,
  obtenerMiembrosTablero,
} from '../../lib/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { CRMTarea, CRMTareaAdjunto, EstatusTarea, PrioridadTarea, CRMContacto, CRMBoardMemberDetail } from '../../lib/crmTypes';

interface Props {
  contactoId?: string;
  tarea?: CRMTarea;
  boardId?: string | null;
  initialFechaVencimiento?: string;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}

export default function TareaModal({ contactoId, tarea, boardId, initialFechaVencimiento, onClose, onSave, onDelete }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [contactos, setContactos] = useState<CRMContacto[]>([]);
  const [busquedaContacto, setBusquedaContacto] = useState('');
  const [mostrarListaContactos, setMostrarListaContactos] = useState(false);
  const [adjuntos, setAdjuntos] = useState<CRMTareaAdjunto[]>([]);
  const [subiendoAdjunto, setSubiendoAdjunto] = useState(false);
  const [miembrosTablero, setMiembrosTablero] = useState<CRMBoardMemberDetail[]>([]);

  const getFechaVencimientoInicial = () => {
    if (tarea?.fecha_vencimiento) {
      return new Date(tarea.fecha_vencimiento).toISOString().slice(0, 16);
    }
    if (initialFechaVencimiento) {
      const date = new Date(initialFechaVencimiento);
      date.setHours(12, 0, 0, 0);
      return date.toISOString().slice(0, 16);
    }
    return '';
  };

  const [formData, setFormData] = useState({
    descripcion: tarea?.descripcion || '',
    tipo_actividad: tarea?.tipo_actividad || 'Llamada',
    fecha_vencimiento: getFechaVencimientoInicial(),
    prioridad: (tarea?.prioridad || 'Media') as PrioridadTarea,
    estatus: (tarea?.estatus || 'Pendiente') as EstatusTarea,
    contacto_id: contactoId || tarea?.contacto_id || '',
    board_id: boardId || tarea?.board_id || null,
    asignado_a: tarea?.asignado_a || '',
  });

  useEffect(() => {
    cargarContactos();
    if (tarea) {
      cargarAdjuntos();
    }
    if (formData.board_id) {
      cargarMiembrosTablero();
    }
  }, [tarea, formData.board_id]);

  const cargarContactos = async () => {
    try {
      const data = await obtenerContactos();
      setContactos(data);
    } catch (error) {
      console.error('Error al cargar contactos:', error);
    }
  };

  const cargarAdjuntos = async () => {
    if (!tarea) return;
    try {
      const data = await obtenerAdjuntosTarea(tarea.id);
      setAdjuntos(data);
    } catch (error) {
      console.error('Error al cargar adjuntos:', error);
    }
  };

  const cargarMiembrosTablero = async () => {
    if (!formData.board_id) return;
    try {
      const miembros = await obtenerMiembrosTablero(formData.board_id);
      setMiembrosTablero(miembros);
    } catch (error) {
      console.error('Error al cargar miembros del tablero:', error);
    }
  };

  const contactoSeleccionado = contactos.find((c) => c.id === formData.contacto_id);

  const contactosFiltrados = contactos.filter((contacto) =>
    contacto.nombre_completo.toLowerCase().includes(busquedaContacto.toLowerCase()) ||
    contacto.celular?.includes(busquedaContacto) ||
    contacto.email?.toLowerCase().includes(busquedaContacto.toLowerCase())
  );

  const seleccionarContacto = (contactoId: string) => {
    setFormData({ ...formData, contacto_id: contactoId });
    setMostrarListaContactos(false);
    setBusquedaContacto('');
  };

  const limpiarContacto = () => {
    setFormData({ ...formData, contacto_id: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      const data: any = {
        descripcion: formData.descripcion,
        tipo_actividad: formData.tipo_actividad as any,
        fecha_vencimiento: formData.fecha_vencimiento,
        prioridad: formData.prioridad,
        estatus: formData.estatus,
        contacto_id: formData.contacto_id || null,
        board_id: formData.board_id || null,
        asignado_a: formData.asignado_a || null,
      };

      if (tarea) {
        await actualizarTarea(tarea.id, data);
      } else {
        await crearTarea(data, user.id);
      }

      onSave();
    } catch (error: any) {
      console.error('Error completo:', error);
      const errorMessage = error?.message || error?.error_description || 'Error al guardar tarea';
      alert(`Error al guardar tarea: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !tarea) return;

    const archivo = e.target.files[0];

    try {
      setSubiendoAdjunto(true);
      const nuevoAdjunto = await subirAdjuntoTarea(tarea.id, archivo, user.id);
      setAdjuntos([...adjuntos, nuevoAdjunto]);
      e.target.value = '';
    } catch (error: any) {
      console.error('Error al subir adjunto:', error);
      alert(error.message || 'Error al subir archivo');
    } finally {
      setSubiendoAdjunto(false);
    }
  };

  const handleEliminarAdjunto = async (adjuntoId: string) => {
    if (!confirm('¿Estás seguro de eliminar este adjunto?')) return;

    try {
      await eliminarAdjuntoTarea(adjuntoId);
      setAdjuntos(adjuntos.filter((a) => a.id !== adjuntoId));
    } catch (error) {
      console.error('Error al eliminar adjunto:', error);
      alert('Error al eliminar archivo');
    }
  };

  const handleDescargarAdjunto = async (adjunto: CRMTareaAdjunto) => {
    try {
      await descargarAdjuntoTarea(adjunto);
    } catch (error) {
      console.error('Error al descargar adjunto:', error);
      alert('Error al descargar archivo');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {tarea ? 'Editar Tarea' : 'Nueva Tarea'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Actividad *
              </label>
              <select
                value={formData.tipo_actividad}
                onChange={(e) => setFormData({ ...formData, tipo_actividad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="Llamada">Llamada</option>
                <option value="Email">Email</option>
                <option value="Reunión">Reunión</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Flag className="h-4 w-4" />
                Prioridad *
              </label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as PrioridadTarea })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estatus *</label>
            <select
              value={formData.estatus}
              onChange={(e) => setFormData({ ...formData, estatus: e.target.value as EstatusTarea })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Completada">Completada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <User className="h-4 w-4" />
              Contacto Relacionado
            </label>
            {contactoSeleccionado ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-semibold">
                    {contactoSeleccionado.nombre_completo.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {contactoSeleccionado.nombre_completo}
                    </p>
                    <p className="text-xs text-gray-600">{contactoSeleccionado.celular}</p>
                  </div>
                </div>
                {!contactoId && (
                  <button
                    type="button"
                    onClick={limpiarContacto}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaContacto}
                    onChange={(e) => {
                      setBusquedaContacto(e.target.value);
                      setMostrarListaContactos(true);
                    }}
                    onFocus={() => setMostrarListaContactos(true)}
                    placeholder="Buscar contacto (opcional)..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {mostrarListaContactos && busquedaContacto && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {contactosFiltrados.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        No se encontraron contactos
                      </div>
                    ) : (
                      contactosFiltrados.map((contacto) => (
                        <button
                          key={contacto.id}
                          type="button"
                          onClick={() => seleccionarContacto(contacto.id)}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-semibold text-xs">
                            {contacto.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-gray-900 text-sm">
                              {contacto.nombre_completo}
                            </p>
                            <p className="text-xs text-gray-600">{contacto.celular}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {formData.board_id && miembrosTablero.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <UserCircle className="h-4 w-4" />
                Responsable
              </label>
              <select
                value={formData.asignado_a}
                onChange={(e) => setFormData({ ...formData, asignado_a: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sin asignar</option>
                {miembrosTablero.map((miembro) => (
                  <option key={miembro.user_id} value={miembro.user_id}>
                    {miembro.user_name} ({miembro.user_office})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Solo los miembros de este tablero compartido pueden ser asignados
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={4}
              required
              placeholder="Describe la tarea a realizar..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y Hora de Vencimiento *
            </label>
            <input
              type="datetime-local"
              value={formData.fecha_vencimiento}
              onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Documentos Adjuntos {tarea ? `(${adjuntos.length}/5)` : ''}
            </label>

            {tarea ? (
              <>
                {adjuntos.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {adjuntos.map((adjunto) => (
                      <div
                        key={adjunto.id}
                        className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {adjunto.nombre_archivo}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(adjunto.tamano_bytes)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDescargarAdjunto(adjunto)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarAdjunto(adjunto.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {adjuntos.length < 5 && (
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      onChange={handleFileUpload}
                      disabled={subiendoAdjunto}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        subiendoAdjunto
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                          : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <Upload className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {subiendoAdjunto ? 'Subiendo archivo...' : 'Subir documento (máx. 50MB)'}
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Cualquier formato de archivo permitido
                    </p>
                  </div>
                )}

                {adjuntos.length >= 5 && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Límite alcanzado. Elimina un adjunto para subir otro.
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">
                    Adjuntos disponibles después de crear
                  </h4>
                  <p className="text-xs text-blue-700">
                    Guarda la tarea primero y luego podrás agregar hasta 5 archivos de cualquier formato (máx. 50MB cada uno)
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {tarea && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-2"
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Tarea'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
