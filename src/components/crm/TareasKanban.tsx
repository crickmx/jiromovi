import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle2, Loader, Flag, Calendar, User, X, Paperclip } from 'lucide-react';

interface Tarea {
  id: string;
  descripcion: string;
  tipo_actividad: string;
  fecha_vencimiento: string;
  estatus: 'Pendiente' | 'En Proceso' | 'Completada';
  prioridad: 'Alta' | 'Media' | 'Baja';
  contacto_id?: string;
  adjuntos_count?: number;
  asignado_a?: string;
  crm_contactos?: {
    nombre_completo: string;
  };
  responsable?: {
    id: string;
    nombre: string;
    apellidos: string;
    avatar_url?: string;
  };
}

interface TareasKanbanProps {
  tareas: Tarea[];
  onUpdateEstatus: (tareaId: string, nuevoEstatus: 'Pendiente' | 'En Proceso' | 'Completada') => Promise<void>;
  onVerDetalle: (tarea: Tarea) => void;
  loading?: boolean;
}

export default function TareasKanban({ tareas, onUpdateEstatus, onVerDetalle, loading }: TareasKanbanProps) {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [draggingOverColumn, setDraggingOverColumn] = useState<string | null>(null);

  const columnas: Array<{ id: 'Pendiente' | 'En Proceso' | 'Completada'; titulo: string; icon: any; color: string; bgColor: string }> = [
    {
      id: 'Pendiente',
      titulo: 'Pendiente',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'En Proceso',
      titulo: 'En Proceso',
      icon: Loader,
      color: 'text-accent',
      bgColor: 'bg-primary-50'
    },
    {
      id: 'Completada',
      titulo: 'Completada',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Baja':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPrioridadIcon = (prioridad: string) => {
    const baseClass = "h-4 w-4";
    switch (prioridad) {
      case 'Alta':
        return <Flag className={`${baseClass} text-red-600`} fill="currentColor" />;
      case 'Media':
        return <Flag className={`${baseClass} text-yellow-600`} />;
      case 'Baja':
        return <Flag className={`${baseClass} text-green-600`} />;
      default:
        return <Flag className={`${baseClass} text-gray-600`} />;
    }
  };

  const isVencida = (fecha: string, estatus: string) => {
    if (estatus === 'Completada') return false;
    return new Date(fecha) < new Date();
  };

  const getDiasRestantes = (fecha: string) => {
    const hoy = new Date();
    const vencimiento = new Date(fecha);
    const diff = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleDragStart = (e: React.DragEvent, tareaId: string) => {
    setDraggedTask(tareaId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDraggingOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (columna: string) => {
    setDraggingOverColumn(columna);
  };

  const handleDragLeave = () => {
    setDraggingOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, nuevoEstatus: 'Pendiente' | 'En Proceso' | 'Completada') => {
    e.preventDefault();
    setDraggingOverColumn(null);

    if (!draggedTask) return;

    const tarea = tareas.find(t => t.id === draggedTask);
    if (!tarea || tarea.estatus === nuevoEstatus) {
      setDraggedTask(null);
      return;
    }

    await onUpdateEstatus(draggedTask, nuevoEstatus);
    setDraggedTask(null);
  };

  const tareasPorColumna = (estatus: string) => {
    return tareas.filter(t => t.estatus === estatus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-4">
      {columnas.map((columna) => {
        const tareasColumna = tareasPorColumna(columna.id);
        const Icon = columna.icon;

        return (
          <div
            key={columna.id}
            className="flex-1 min-w-[320px] lg:min-w-0"
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter(columna.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, columna.id)}
          >
            <div className={`${columna.bgColor} rounded-t-lg p-4 border-b-2 ${columna.color.replace('text-', 'border-')}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${columna.color}`} />
                  <h3 className={`font-semibold ${columna.color}`}>{columna.titulo}</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${columna.color} bg-white`}>
                  {tareasColumna.length}
                </span>
              </div>
            </div>

            <div
              className={`min-h-[400px] p-3 space-y-3 bg-gray-50 rounded-b-lg transition-colors ${
                draggingOverColumn === columna.id ? 'bg-primary-100 border-2 border-primary-400 border-dashed' : ''
              }`}
            >
              {tareasColumna.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Icon className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No hay tareas</p>
                </div>
              ) : (
                tareasColumna.map((tarea) => {
                  const vencida = isVencida(tarea.fecha_vencimiento, tarea.estatus);
                  const diasRestantes = getDiasRestantes(tarea.fecha_vencimiento);

                  return (
                    <div
                      key={tarea.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tarea.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onVerDetalle(tarea)}
                      className={`bg-white rounded-lg p-4 shadow-sm border-2 cursor-move hover:shadow-md transition-all ${
                        draggedTask === tarea.id ? 'opacity-50 rotate-2 scale-95' : ''
                      } ${vencida ? 'border-red-300' : 'border-gray-200 hover:border-primary-300'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          {getPrioridadIcon(tarea.prioridad)}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getPrioridadColor(tarea.prioridad)}`}>
                            {tarea.prioridad}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md font-medium whitespace-nowrap ml-2">
                          {tarea.tipo_actividad}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-gray-900 mb-3 line-clamp-2">
                        {tarea.descripcion}
                      </p>

                      {tarea.crm_contactos?.nombre_completo && (
                        <div className="flex items-center space-x-2 mb-3 text-xs text-gray-600">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">{tarea.crm_contactos.nombre_completo}</span>
                        </div>
                      )}

                      {tarea.responsable && (
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="flex items-center space-x-1.5">
                            {tarea.responsable.avatar_url ? (
                              <img
                                src={tarea.responsable.avatar_url}
                                alt={`${tarea.responsable.nombre} ${tarea.responsable.apellidos}`}
                                className="h-6 w-6 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold border border-purple-200">
                                {tarea.responsable.nombre.charAt(0)}{tarea.responsable.apellidos.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs text-gray-700 font-medium">
                              {tarea.responsable.nombre} {tarea.responsable.apellidos}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1.5">
                            <Calendar className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-xs text-gray-600">
                              {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          </div>

                          {tarea.adjuntos_count && tarea.adjuntos_count > 0 && (
                            <div className="flex items-center space-x-1 text-gray-500">
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="text-xs">{tarea.adjuntos_count}</span>
                            </div>
                          )}
                        </div>

                        {vencida ? (
                          <div className="flex items-center space-x-1 text-red-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Vencida</span>
                          </div>
                        ) : diasRestantes <= 2 && tarea.estatus !== 'Completada' ? (
                          <div className="flex items-center space-x-1 text-orange-600">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">
                              {diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Mañana' : `${diasRestantes}d`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
