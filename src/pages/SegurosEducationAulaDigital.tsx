import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';

export function SegurosEducationAulaDigital() {
  const { usuario } = useAuth();

  // Estados para eventos
  const [eventos, setEventos] = useState<AulaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<AulaEvento | null>(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<PermisosSeleccionados | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminPermissions();
    cargarEventos();
  }, [usuario]);

  const checkAdminPermissions = async () => {
    if (!usuario) {
      setIsAdmin(false);
      return;
    }

    if (usuario.rol === 'Administrador') {
      setIsAdmin(true);
      return;
    }

    if (usuario.rol === 'Gerente') {
      try {
        const { data, error } = await supabase.rpc('tiene_permiso_admin_en_modulo', {
          p_usuario_id: usuario.id,
          p_modulo_codigo: 'seguros_education'
        });

        if (!error && data) {
          setIsAdmin(true);
          return;
        }
      } catch (error) {
        console.error('Error verificando permisos:', error);
      }
    }

    setIsAdmin(false);
  };

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
      <>
        <SegurosEducationLayout sectionTitle="Aula Virtual" sectionDescription="Capacitaciones y eventos en vivo">
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#1C37E0]/20 border-t-[#1C37E0] rounded-full animate-spin" />
          </div>
        </SegurosEducationLayout>
      </>
    );
  }

  return (
    <>
      <SegurosEducationLayout sectionTitle="Aula Virtual" sectionDescription="Capacitaciones y eventos en vivo">
      <div className="space-y-5">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">Eventos y sesiones</h2>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">{eventos.length} evento{eventos.length !== 1 ? 's' : ''} disponible{eventos.length !== 1 ? 's' : ''}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setEventoSeleccionado(null);
                setPermisosSeleccionados(undefined);
                setShowEventoModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C37E0] text-white text-sm font-semibold hover:bg-[#1630C8] transition-all shadow-sm"
            >
              <Video className="w-4 h-4" />
              Nuevo Evento
            </button>
          )}
        </div>

        {/* Contenido de Eventos */}
        <div>
          {eventos.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border-2 border-dashed border-neutral-200 dark:border-white/10 p-14 text-center">
              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-neutral-400" />
              </div>
              <h3 className="text-base font-bold text-neutral-700 dark:text-white/70 mb-1">Sin eventos disponibles</h3>
              <p className="text-sm text-neutral-400">
                {isAdmin ? 'Crea tu primer evento para comenzar' : 'No tienes eventos programados en este momento'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      </SegurosEducationLayout>
    </>
  );
}
