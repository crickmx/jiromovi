import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Link as LinkIcon, FileText, Save } from 'lucide-react';
import { SelectorPermisos, PermisosSeleccionados } from './SelectorPermisos';
import { AulaEvento } from '../../lib/aulaEventosUtils';

interface FormularioEventoProps {
  evento?: AulaEvento | null;
  permisosIniciales?: PermisosSeleccionados;
  onSubmit: (evento: EventoData, permisos: PermisosSeleccionados) => Promise<void>;
  onClose: () => void;
}

export interface EventoData {
  titulo: string;
  descripcion: string;
  ponente: string;
  fecha: string;
  hora: string;
  link_sesion: string;
}

export function FormularioEvento({ evento, permisosIniciales, onSubmit, onClose }: FormularioEventoProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<EventoData>({
    titulo: evento?.titulo || '',
    descripcion: evento?.descripcion || '',
    ponente: evento?.ponente || '',
    fecha: evento?.fecha || '',
    hora: evento?.hora || '',
    link_sesion: evento?.link_sesion || ''
  });

  const [permisos, setPermisos] = useState<PermisosSeleccionados>(
    permisosIniciales || {
      visible_para_todos: true,
      roles: [],
      oficinas: [],
      usuarios: []
    }
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es obligatorio';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!formData.ponente.trim()) {
      newErrors.ponente = 'El ponente/instructor es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }

    if (!formData.hora) {
      newErrors.hora = 'La hora es obligatoria';
    }

    if (!formData.link_sesion.trim()) {
      newErrors.link_sesion = 'El link de la sesión es obligatorio';
    } else if (!formData.link_sesion.startsWith('http')) {
      newErrors.link_sesion = 'El link debe comenzar con http:// o https://';
    }

    // Validar permisos
    if (!permisos.visible_para_todos) {
      if (permisos.roles.length === 0 && permisos.oficinas.length === 0 && permisos.usuarios.length === 0) {
        newErrors.permisos = 'Debes seleccionar al menos un permiso o marcar "Visible para todos"';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await onSubmit(formData, permisos);
      onClose();
    } catch (error: any) {
      console.error('Error guardando evento:', error);
      setErrors({ submit: error.message || 'Error al guardar el evento' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-neutral-800">
            {evento ? 'Editar Evento' : 'Crear Nuevo Evento'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Información del Evento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Información del Evento
            </h3>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Título del Evento *
              </label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                  errors.titulo ? 'border-red-500' : 'border-neutral-300'
                }`}
                placeholder="Ej: Capacitación en Seguros de Vida"
              />
              {errors.titulo && (
                <p className="mt-1 text-sm text-red-600">{errors.titulo}</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Descripción *
              </label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={4}
                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                  errors.descripcion ? 'border-red-500' : 'border-neutral-300'
                }`}
                placeholder="Describe el contenido y objetivos del evento..."
              />
              {errors.descripcion && (
                <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
              )}
            </div>

            {/* Ponente */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Ponente / Instructor *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  value={formData.ponente}
                  onChange={(e) => setFormData({ ...formData, ponente: e.target.value })}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                    errors.ponente ? 'border-red-500' : 'border-neutral-300'
                  }`}
                  placeholder="Nombre del instructor"
                />
              </div>
              {errors.ponente && (
                <p className="mt-1 text-sm text-red-600">{errors.ponente}</p>
              )}
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Fecha *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                      errors.fecha ? 'border-red-500' : 'border-neutral-300'
                    }`}
                  />
                </div>
                {errors.fecha && (
                  <p className="mt-1 text-sm text-red-600">{errors.fecha}</p>
                )}
              </div>

              {/* Hora */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Hora *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="time"
                    value={formData.hora}
                    onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                      errors.hora ? 'border-red-500' : 'border-neutral-300'
                    }`}
                  />
                </div>
                {errors.hora && (
                  <p className="mt-1 text-sm text-red-600">{errors.hora}</p>
                )}
              </div>
            </div>

            {/* Link de la Sesión */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Link de la Sesión *
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="url"
                  value={formData.link_sesion}
                  onChange={(e) => setFormData({ ...formData, link_sesion: e.target.value })}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-primary-500 transition ${
                    errors.link_sesion ? 'border-red-500' : 'border-neutral-300'
                  }`}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
              </div>
              {errors.link_sesion && (
                <p className="mt-1 text-sm text-red-600">{errors.link_sesion}</p>
              )}
              <p className="mt-1 text-xs text-neutral-500">
                Este link no se mostrará directamente, aparecerá como un botón "Ingresar"
              </p>
            </div>
          </div>

          {/* Selector de Permisos */}
          <div className="border-t border-neutral-200 pt-6">
            <SelectorPermisos
              permisos={permisos}
              onChange={setPermisos}
            />
            {errors.permisos && (
              <p className="mt-2 text-sm text-red-600">{errors.permisos}</p>
            )}
          </div>

          {/* Error general */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{evento ? 'Actualizar Evento' : 'Crear Evento'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
