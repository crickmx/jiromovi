import { useState } from 'react';
import { Calendar, ListFilter as Filter, X, User, Clock, Flag, CircleAlert as AlertCircle, Trash2 } from 'lucide-react';
import type { CRMTarea } from '../../lib/crmTypes';
import { supabase } from '../../lib/supabase';
import TareaModal from './TareaModal';

interface CRMBoardCalendarViewProps {
  tareas: CRMTarea[];
  boardId?: string | null;
  onRefresh: () => void;
  loading?: boolean;
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const PRIORITY_COLORS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baja: 'bg-green-100 text-green-700 border-green-200',
};

export default function CRMBoardCalendarView({ tareas, boardId, onRefresh, loading }: CRMBoardCalendarViewProps) {
  const [selectedTarea, setSelectedTarea] = useState<CRMTarea | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const filtered = tareas.filter(t => {
    if (filterPriority !== 'all' && t.prioridad !== filterPriority) return false;
    return true;
  });

  const tasksInMonth = filtered.filter(t => {
    if (!t.fecha_vencimiento) return false;
    const d = new Date(t.fecha_vencimiento);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).sort((a, b) => new Date(a.fecha_vencimiento!).getTime() - new Date(b.fecha_vencimiento!).getTime());

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('crm_tareas').update({ deleted_at: new Date().toISOString() }).eq('id', confirmDelete.id);
    setConfirmDelete(null);
    onRefresh();
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 rotate-45 opacity-60" />
          </button>
          <span className="font-semibold text-gray-800 min-w-[140px] text-center">
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <Calendar className="w-4 h-4 opacity-60" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tasksInMonth.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Calendar className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-medium">Sin tareas en {MONTHS[currentMonth]}</p>
          <p className="text-sm mt-1">Cambia el mes o el filtro para ver más tareas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasksInMonth.map(tarea => {
            const due = new Date(tarea.fecha_vencimiento!);
            const isOverdue = due < now && tarea.estado !== 'completada';
            return (
              <div
                key={tarea.id}
                onClick={() => setSelectedTarea(tarea)}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                <div className="flex-shrink-0 w-10 text-center">
                  <p className="text-lg font-bold text-gray-800 leading-none">{due.getDate()}</p>
                  <p className="text-xs text-gray-400">{MONTHS[due.getMonth()].slice(0,3)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{tarea.titulo}</p>
                  {tarea.descripcion && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{tarea.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOverdue && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {tarea.prioridad && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[tarea.prioridad] ?? 'bg-gray-100 text-gray-600'}`}>
                      {tarea.prioridad}
                    </span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ id: tarea.id, nombre: tarea.titulo }); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTarea && (
        <TareaModal
          tarea={selectedTarea}
          boardId={boardId ?? null}
          onClose={() => setSelectedTarea(null)}
          onSave={() => { setSelectedTarea(null); onRefresh(); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-2">Eliminar tarea</h3>
            <p className="text-sm text-gray-500 mb-5">
              ¿Seguro que quieres eliminar <strong>"{confirmDelete.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
