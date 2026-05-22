import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  LayoutGrid,
  List,
  Calendar,
  Flag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  User,
  Users,
  KanbanSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TareasKanban from '../components/crm/TareasKanban';
import CRMBoardCalendarView from '../components/crm/CRMBoardCalendarView';
import TareaModal from '../components/crm/TareaModal';
import type { CRMTarea, EstatusTarea } from '../lib/crmTypes';
import { PageHeader } from '@/components/ui/page-header';

type Vista = 'lista' | 'kanban' | 'calendario';
type FiltroEstatus = 'todas' | 'Pendiente' | 'En Proceso' | 'Completada' | 'vencidas';

interface BoardInfo {
  id: string;
  name: string;
  my_role: string;
  members_count: number;
}

export default function CRMTareas() {
  useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const boardId = searchParams.get('board');

  const [vista, setVista] = useState<Vista>('kanban');
  const [tareas, setTareas] = useState<CRMTarea[]>([]);
  const [tareasFiltradas, setTareasFiltradas] = useState<CRMTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tareaEditar, setTareaEditar] = useState<CRMTarea | undefined>();
  const [filtroEstatus, setFiltroEstatus] = useState<FiltroEstatus>('todas');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [boardInfo, setBoardInfo] = useState<BoardInfo | null>(null);

  useEffect(() => {
    cargarTareas();
    if (boardId) {
      cargarInfoTablero();
      // En tableros compartidos, si está en vista calendario, cambiar a kanban
      if (vista === 'calendario') {
        setVista('kanban');
      }
    }
  }, [boardId]);

  useEffect(() => {
    aplicarFiltros();
  }, [tareas, filtroEstatus, filtroPrioridad, busqueda]);

  const cargarInfoTablero = async () => {
    if (!boardId) return;

    try {
      const { data, error } = await supabase.rpc('crm_list_boards_for_user');

      if (error) throw error;

      const board = data?.find((b: any) => b.board_id === boardId);
      if (board) {
        setBoardInfo({
          id: board.board_id,
          name: board.board_name,
          my_role: board.my_role,
          members_count: board.members_count,
        });
      }
    } catch (error) {
      console.error('Error al cargar info del tablero:', error);
    }
  };

  const cargarTareas = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('crm_tareas')
        .select(`
          *,
          crm_contactos(nombre_completo),
          responsable:usuarios!crm_tareas_asignado_a_fkey(id, nombre, apellidos, imagen_perfil_url)
        `)
        .order('fecha_vencimiento', { ascending: true });

      // Filtrar por tablero si existe boardId
      if (boardId) {
        query = query.eq('board_id', boardId);
      } else {
        // Sin boardId, mostrar solo tareas personales (sin tablero)
        query = query.is('board_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Obtener el conteo de adjuntos para cada tarea
      const tareasConAdjuntos = await Promise.all(
        (data || []).map(async (tarea) => {
          const { count } = await supabase
            .from('crm_tareas_adjuntos')
            .select('*', { count: 'exact', head: true })
            .eq('tarea_id', tarea.id);

          return {
            ...tarea,
            adjuntos_count: count || 0,
          };
        })
      );

      setTareas(tareasConAdjuntos);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let resultado = [...tareas];

    if (filtroEstatus === 'vencidas') {
      const ahora = new Date();
      resultado = resultado.filter(
        (t) => t.estatus !== 'Completada' && new Date(t.fecha_vencimiento) < ahora
      );
    } else if (filtroEstatus !== 'todas') {
      resultado = resultado.filter((t) => t.estatus === filtroEstatus);
    }

    if (filtroPrioridad !== 'todas') {
      resultado = resultado.filter((t) => t.prioridad === filtroPrioridad);
    }

    if (busqueda.trim()) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(
        (t) =>
          t.descripcion.toLowerCase().includes(busquedaLower) ||
          t.tipo_actividad.toLowerCase().includes(busquedaLower) ||
          t.crm_contactos?.nombre_completo.toLowerCase().includes(busquedaLower)
      );
    }

    setTareasFiltradas(resultado);
  };

  const handleUpdateEstatus = async (tareaId: string, nuevoEstatus: EstatusTarea) => {
    try {
      const { error } = await supabase
        .from('crm_tareas')
        .update({ estatus: nuevoEstatus })
        .eq('id', tareaId);

      if (error) throw error;

      await cargarTareas();
    } catch (error) {
      console.error('Error al actualizar estatus:', error);
      alert('Error al actualizar la tarea');
    }
  };

  const handleVerDetalle = (tarea: CRMTarea) => {
    setTareaEditar(tarea);
    setShowModal(true);
  };

  const handleNuevaTarea = () => {
    setTareaEditar(undefined);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTareaEditar(undefined);
  };

  const handleSaveTarea = () => {
    handleCloseModal();
    cargarTareas();
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Baja':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const getEstatusColor = (estatus: string) => {
    switch (estatus) {
      case 'Completada':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'En Proceso':
        return 'bg-primary-100 text-primary-800 border-primary-200';
      case 'Pendiente':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-200';
    }
  };

  const isVencida = (fecha: string, estatus: string) => {
    if (estatus === 'Completada') return false;
    return new Date(fecha) < new Date();
  };

  const contadores = {
    total: tareas.length,
    pendientes: tareas.filter((t) => t.estatus === 'Pendiente').length,
    enProceso: tareas.filter((t) => t.estatus === 'En Proceso').length,
    completadas: tareas.filter((t) => t.estatus === 'Completada').length,
    vencidas: tareas.filter(
      (t) => t.estatus !== 'Completada' && new Date(t.fecha_vencimiento) < new Date()
    ).length,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <PageHeader
          title={boardInfo ? boardInfo.name : 'Mis Tareas'}
          description={boardInfo ? undefined : 'Gestiona tus actividades y seguimientos personales'}
          icon={KanbanSquare}
          backTo="/mi-crm"
          backLabel="Mi CRM"
          badge={boardInfo ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <Users className="h-4 w-4" />
                {boardInfo.members_count} miembros
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm capitalize">
                {boardInfo.my_role === 'owner' && 'Propietario'}
                {boardInfo.my_role === 'admin' && 'Administrador'}
                {boardInfo.my_role === 'editor' && 'Editor'}
                {boardInfo.my_role === 'viewer' && 'Visualizador'}
              </span>
            </div>
          ) : undefined}
          actions={
            <button
              onClick={handleNuevaTarea}
              className="flex items-center justify-center gap-2 bg-accent text-white px-6 py-3 rounded-lg hover:bg-accent/90 transition shadow-md hover:shadow-lg"
            >
              <Plus className="h-5 w-5" />
              Nueva Tarea
            </button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 mb-6">
          <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-600 dark:text-white/60 font-medium">Total</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{contadores.total}</p>
              </div>
              <List className="h-8 w-8 text-neutral-400 dark:text-white/30" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 p-4 rounded-lg border border-orange-200 dark:border-orange-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">Pendientes</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-300 mt-1">{contadores.pendientes}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 p-4 rounded-lg border border-primary-200 dark:border-primary-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-700 dark:text-primary-400 font-medium">En Proceso</p>
                <p className="text-2xl font-bold text-primary-900 dark:text-primary-300 mt-1">{contadores.enProceso}</p>
              </div>
              <Clock className="h-8 w-8 text-primary-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Completadas</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-1">{contadores.completadas}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 p-4 rounded-lg border border-red-200 dark:border-red-800/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">Vencidas</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-300 mt-1">{contadores.vencidas}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-none border border-neutral-200 dark:border-neutral-700 mb-6 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400 dark:text-white/40" />
              <input
                type="text"
                placeholder="Buscar tareas..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          {boardId && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800 font-medium">Calendario siempre visible</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <select
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value as FiltroEstatus)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            >
              <option value="todas">Todos los estatus</option>
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Completada">Completada</option>
              <option value="vencidas">Vencidas</option>
            </select>

            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
            >
              <option value="todas">Todas las prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>

            <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setVista('kanban')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                  vista === 'kanban' ? 'bg-white dark:bg-neutral-700 shadow text-accent' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              {!boardId && (
                <button
                  onClick={() => setVista('calendario')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                    vista === 'calendario' ? 'bg-white dark:bg-neutral-700 shadow text-accent' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Calendario</span>
                </button>
              )}
              <button
                onClick={() => setVista('lista')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition ${
                  vista === 'lista' ? 'bg-white dark:bg-neutral-700 shadow text-accent' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* En tableros compartidos: calendario siempre visible arriba */}
      {boardId && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              Calendario de Tareas
            </h2>
            <span className="text-xs text-neutral-500 dark:text-white/50 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-full">
              Vista permanente en tableros compartidos
            </span>
          </div>
          <CRMBoardCalendarView
            tareas={tareasFiltradas}
            boardId={boardId}
            onRefresh={cargarTareas}
            loading={loading}
          />
        </div>
      )}

      {/* Separador visual en tableros compartidos */}
      {boardId && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-neutral-200 dark:from-neutral-700 to-transparent"></div>
          <span className="text-sm font-medium text-neutral-600 dark:text-white/60 flex items-center gap-2">
            {vista === 'lista' ? (
              <>
                <List className="h-4 w-4" />
                Vista de Lista
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                Vista Kanban
              </>
            )}
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-neutral-200 dark:from-neutral-700 to-transparent"></div>
        </div>
      )}

      {/* Vista principal según selección */}
      {(vista === 'kanban' || (vista === 'calendario' && boardId)) ? (
        <TareasKanban
          tareas={tareasFiltradas}
          onUpdateEstatus={handleUpdateEstatus}
          onVerDetalle={handleVerDetalle as any}
          loading={loading}
        />
      ) : vista === 'calendario' && !boardId ? (
        <CRMBoardCalendarView
          tareas={tareasFiltradas}
          boardId={boardId}
          onRefresh={cargarTareas}
          loading={loading}
        />
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow dark:shadow-none border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-16 w-16 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
              <p className="text-neutral-500 dark:text-white/50 text-lg mb-2">No hay tareas</p>
              <p className="text-neutral-400 dark:text-white/40 text-sm">
                {busqueda || filtroEstatus !== 'todas' || filtroPrioridad !== 'todas'
                  ? 'Intenta cambiar los filtros'
                  : 'Crea tu primera tarea para comenzar'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Tarea</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Contacto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Prioridad</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Estatus</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-white/50 uppercase">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {tareasFiltradas.map((tarea) => {
                    const vencida = isVencida(tarea.fecha_vencimiento, tarea.estatus);

                    return (
                      <tr
                        key={tarea.id}
                        onClick={() => handleVerDetalle(tarea)}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition"
                      >
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2">{tarea.descripcion}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-neutral-600 dark:text-white/60">{tarea.tipo_actividad}</span>
                        </td>
                        <td className="px-6 py-4">
                          {tarea.crm_contactos?.nombre_completo ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-neutral-400 dark:text-white/40" />
                              <span className="text-sm text-neutral-700 dark:text-white/70">{tarea.crm_contactos.nombre_completo}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-neutral-400 dark:text-white/40">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getPrioridadColor(
                              tarea.prioridad
                            )}`}
                          >
                            <Flag className="h-3 w-3" />
                            {tarea.prioridad}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getEstatusColor(
                              tarea.estatus
                            )}`}
                          >
                            {tarea.estatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-neutral-400 dark:text-white/40" />
                            <span className={`text-sm ${vencida ? 'text-red-600 font-semibold' : 'text-neutral-700 dark:text-white/70'}`}>
                              {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {vencida && <AlertCircle className="h-4 w-4 text-red-600" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <TareaModal
          tarea={tareaEditar}
          boardId={boardId}
          onClose={handleCloseModal}
          onSave={handleSaveTarea}
        />
      )}
    </div>
  );
}
