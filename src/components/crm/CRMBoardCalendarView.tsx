import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import { Calendar, Filter, X, User, Clock, Flag, AlertCircle, Trash2 } from 'lucide-react';
import type { CRMTarea, CRMBoardMemberDetail } from '../../lib/crmTypes';
import { supabase } from '../../lib/supabase';
import { obtenerMiembrosTablero } from '../../lib/crmUtils';
import TareaModal from './TareaModal';

interface CRMBoardCalendarViewProps {
  tareas: CRMTarea[];
  boardId?: string | null;
  onRefresh: () => void;
  loading?: boolean;
}

interface ConfirmDeleteModal {
  isOpen: boolean;
  tareaId: string;
  tareaNombre: string;
}

export default function CRMBoardCalendarView({
  tareas,
  boardId,
  onRefresh,
  loading,
}: CRMBoardCalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState<CRMTarea | undefined>();
  const [newTaskDate, setNewTaskDate] = useState<string | undefined>();

  const [showFilters, setShowFilters] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState<string>('todos');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('todos');
  const [miembrosTablero, setMiembrosTablero] = useState<CRMBoardMemberDetail[]>([]);

  const [deleteModal, setDeleteModal] = useState<ConfirmDeleteModal>({
    isOpen: false,
    tareaId: '',
    tareaNombre: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (boardId) {
      cargarMiembrosTablero();
    }
  }, [boardId]);

  const cargarMiembrosTablero = async () => {
    if (!boardId) return;
    try {
      const miembros = await obtenerMiembrosTablero(boardId);
      setMiembrosTablero(miembros);
    } catch (error) {
      console.error('Error al cargar miembros del tablero:', error);
    }
  };

  const getEstatusColor = (estatus: string): string => {
    switch (estatus) {
      case 'Pendiente':
        return '#f97316';
      case 'En Proceso':
        return '#3b82f6';
      case 'Completada':
        return '#22c55e';
      default:
        return '#6b7280';
    }
  };

  const getEstatusTextColor = (estatus: string): string => {
    return '#ffffff';
  };

  const tareasFiltradas = tareas.filter((tarea) => {
    if (filtroUsuario !== 'todos' && tarea.asignado_a !== filtroUsuario) {
      return false;
    }
    if (filtroEstatus !== 'todos' && tarea.estatus !== filtroEstatus) {
      return false;
    }
    return true;
  });

  const eventos: EventInput[] = tareasFiltradas.map((tarea) => {
    const isVencida = tarea.estatus !== 'Completada' && new Date(tarea.fecha_vencimiento) < new Date();

    return {
      id: tarea.id,
      title: tarea.descripcion,
      start: tarea.fecha_vencimiento,
      allDay: true,
      backgroundColor: getEstatusColor(tarea.estatus),
      borderColor: isVencida ? '#dc2626' : getEstatusColor(tarea.estatus),
      textColor: getEstatusTextColor(tarea.estatus),
      extendedProps: {
        tipo_actividad: tarea.tipo_actividad,
        prioridad: tarea.prioridad,
        estatus: tarea.estatus,
        asignado_a: tarea.asignado_a,
        responsable: tarea.responsable,
        isVencida,
      },
    };
  });

  const handleEventClick = (info: EventClickArg) => {
    const tareaId = info.event.id;
    const tarea = tareas.find((t) => t.id === tareaId);
    if (tarea) {
      setSelectedTarea(tarea);
      setNewTaskDate(undefined);
      setShowTareaModal(true);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const selectedDate = selectInfo.startStr;
    setSelectedTarea(undefined);
    setNewTaskDate(selectedDate);
    setShowTareaModal(true);
  };

  const handleCloseTareaModal = () => {
    setShowTareaModal(false);
    setSelectedTarea(undefined);
    setNewTaskDate(undefined);
  };

  const handleSaveTarea = () => {
    handleCloseTareaModal();
    onRefresh();
  };

  const handleEliminarClick = (tareaId: string, tareaNombre: string) => {
    setDeleteModal({
      isOpen: true,
      tareaId,
      tareaNombre,
    });
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('crm_tareas')
        .delete()
        .eq('id', deleteModal.tareaId);

      if (error) throw error;

      onRefresh();
      setDeleteModal({ isOpen: false, tareaId: '', tareaNombre: '' });
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      alert('Error al eliminar la tarea. Por favor, intenta de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, tareaId: '', tareaNombre: '' });
  };

  const renderEventContent = (eventInfo: any) => {
    const { isVencida, prioridad } = eventInfo.event.extendedProps;

    return (
      <div className="flex items-center gap-1 p-1 text-xs overflow-hidden">
        {isVencida && <AlertCircle className="h-3 w-3 flex-shrink-0" />}
        {prioridad === 'Alta' && <Flag className="h-3 w-3 flex-shrink-0" fill="currentColor" />}
        <span className="truncate">{eventInfo.event.title}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Vista de Calendario</h2>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              showFilters
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-200 mb-4">
            {boardId && miembrosTablero.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Usuario Asignado
                </label>
                <select
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="todos">Todos los usuarios</option>
                  {miembrosTablero.map((miembro) => (
                    <option key={miembro.user_id} value={miembro.user_id}>
                      {miembro.user_name} ({miembro.user_office})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Estatus
              </label>
              <select
                value={filtroEstatus}
                onChange={(e) => setFiltroEstatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="todos">Todos los estatus</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Completada">Completada</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
            <span>Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
            <span>En Proceso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
            <span>Completada</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth',
          }}
          events={eventos}
          eventClick={handleEventClick}
          selectable={true}
          select={handleDateSelect}
          eventContent={renderEventContent}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={3}
          moreLinkText="más"
        />
      </div>

      {showTareaModal && (
        <TareaModal
          tarea={selectedTarea}
          boardId={boardId}
          initialFechaVencimiento={newTaskDate}
          onClose={handleCloseTareaModal}
          onSave={handleSaveTarea}
          onDelete={selectedTarea ? () => handleEliminarClick(selectedTarea.id, selectedTarea.descripcion) : undefined}
        />
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Tarea</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700">
                ¿Estás seguro de que deseas eliminar la tarea <strong>"{deleteModal.tareaNombre}"</strong>?
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
