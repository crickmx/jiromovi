import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Menu, Video
} from 'lucide-react';
import {
  obtenerEventos,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  obtenerEventoConPermisos,
  type AulaEvento
} from '../lib/aulaEventosUtils';
import { FormularioEvento, type EventoData } from '../components/eventos/FormularioEvento';
import { TarjetaEvento } from '../components/eventos/TarjetaEvento';
import { type PermisosSeleccionados } from '../components/eventos/SelectorPermisos';

export function SegurosEducationAulaDigital() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados para eventos
  const [eventos, setEventos] = useState<AulaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<AulaEvento | null>(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<PermisosSeleccionados | undefined>();

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      const data = await obtenerEventos();
      setEventos(data);
    } catch (error) {
      console.error('Error cargando eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearEvento = async (eventoData: EventoData, permisos: PermisosSeleccionados) => {
    try {
      await crearEvento(eventoData, permisos);
      await cargarEventos();
      setShowEventoModal(false);
      alert('Evento creado exitosamente. Las notificaciones se han enviado a los usuarios autorizados.');
    } catch (error: any) {
      console.error('Error creando evento:', error);
      throw new Error(error.message || 'Error al crear el evento');
    }
  };

  const handleEditarEvento = async (eventoData: EventoData, permisos: PermisosSeleccionados) => {
    if (!eventoSeleccionado) return;

    try {
      await actualizarEvento(eventoSeleccionado.id, eventoData, permisos);
      await cargarEventos();
      setShowEventoModal(false);
      setEventoSeleccionado(null);
      setPermisosSeleccionados(undefined);
      alert('Evento actualizado exitosamente');
    } catch (error: any) {
      console.error('Error actualizando evento:', error);
      throw new Error(error.message || 'Error al actualizar el evento');
    }
  };

  const handleEliminarEvento = async (evento: AulaEvento) => {
    if (!confirm(`¿Estás seguro de eliminar el evento "${evento.titulo}"?`)) return;

    try {
      await eliminarEvento(evento.id);
      await cargarEventos();
      alert('Evento eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando evento:', error);
      alert('Error al eliminar el evento');
    }
  };

  const handleIngresarEvento = (evento: AulaEvento) => {
    window.open(evento.link_sesion, '_blank');
  };

  const handleAbrirEdicionEvento = async (evento: AulaEvento) => {
    try {
      const eventoConPermisos = await obtenerEventoConPermisos(evento.id);
      if (!eventoConPermisos) return;

      // Construir permisos actuales
      const permisosActuales: PermisosSeleccionados = {
        visible_para_todos: eventoConPermisos.visible_para_todos,
        roles: [],
        oficinas: [],
        usuarios: []
      };

      eventoConPermisos.permisos.forEach(p => {
        if (p.rol) permisosActuales.roles.push(p.rol);
        if (p.oficina_id) permisosActuales.oficinas.push(p.oficina_id);
        if (p.usuario_id) permisosActuales.usuarios.push(p.usuario_id);
      });

      setEventoSeleccionado(evento);
      setPermisosSeleccionados(permisosActuales);
      setShowEventoModal(true);
    } catch (error) {
      console.error('Error cargando permisos del evento:', error);
      alert('Error al cargar los permisos del evento');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header con navegación */}
      <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all"
            title="Ir al menú principal"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
            alt="MOVI Digital Logo"
            className="h-10 object-contain"
          />
          <div className="w-10"></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Botón de regreso */}
        <button
          onClick={() => navigate('/seguros-education')}
          className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Volver a Seguros Education</span>
        </button>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Aula Digital - Eventos</h1>
              <p className="text-blue-100">
                Capacitaciones y eventos en vivo
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setEventoSeleccionado(null);
                  setPermisosSeleccionados(undefined);
                  setShowEventoModal(true);
                }}
                className="flex items-center space-x-2 bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
              >
                <Video className="w-5 h-5" />
                <span>Nuevo Evento</span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido de Eventos */}
        <div className="space-y-6">
          {eventos.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-neutral-300 p-12 text-center">
              <Video className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                No hay eventos disponibles
              </h3>
              <p className="text-neutral-500">
                {isAdmin
                  ? 'Crea tu primer evento para comenzar'
                  : 'No tienes eventos programados en este momento'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {eventos.map(evento => (
                <TarjetaEvento
                  key={evento.id}
                  evento={evento}
                  isAdmin={isAdmin}
                  onIngresar={handleIngresarEvento}
                  onEditar={handleAbrirEdicionEvento}
                  onEliminar={handleEliminarEvento}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modal de Evento */}
        {showEventoModal && (
          <FormularioEvento
            evento={eventoSeleccionado}
            permisosIniciales={permisosSeleccionados}
            onSubmit={eventoSeleccionado ? handleEditarEvento : handleCrearEvento}
            onClose={() => {
              setShowEventoModal(false);
              setEventoSeleccionado(null);
              setPermisosSeleccionados(undefined);
            }}
          />
        )}
      </div>
    </div>
  );
}
