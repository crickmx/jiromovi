import { supabase } from './supabase';
import { crearNotificacionGlobal } from './notificationHelpers';

export interface AulaEvento {
  id: string;
  titulo: string;
  descripcion: string;
  ponente: string;
  fecha: string;
  hora: string;
  link_sesion: string;
  creado_por: string;
  creado_en: string;
  modificado_en: string;
  visible_para_todos: boolean;
}

export interface PermisoEvento {
  id: string;
  evento_id: string;
  usuario_id?: string;
  rol?: string;
  oficina_id?: string;
  creado_en: string;
}

export interface EventoConPermisos extends AulaEvento {
  permisos: PermisoEvento[];
  total_usuarios_con_permiso?: number;
}

export interface FiltrosPermiso {
  visible_para_todos?: boolean;
  roles?: string[];
  oficinas?: string[];
  usuarios?: string[];
}

// Obtener eventos (para usuarios: solo los autorizados, para admin: todos)
export async function obtenerEventos(): Promise<AulaEvento[]> {
  const { data, error } = await supabase
    .from('aula_eventos')
    .select('*')
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Obtener un evento específico
export async function obtenerEvento(id: string): Promise<AulaEvento | null> {
  const { data, error } = await supabase
    .from('aula_eventos')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Obtener permisos de un evento (solo admin)
export async function obtenerPermisosEvento(eventoId: string): Promise<PermisoEvento[]> {
  const { data, error } = await supabase
    .from('aula_eventos_permisos')
    .select('*')
    .eq('evento_id', eventoId);

  if (error) throw error;
  return data || [];
}

// Crear evento con permisos
export async function crearEvento(
  evento: Omit<AulaEvento, 'id' | 'creado_por' | 'creado_en' | 'modificado_en'>,
  filtrosPermiso: FiltrosPermiso
): Promise<string> {
  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  // Crear evento
  const { data: eventoCreado, error: errorEvento } = await supabase
    .from('aula_eventos')
    .insert({
      ...evento,
      creado_por: user.id,
      visible_para_todos: filtrosPermiso.visible_para_todos || false
    })
    .select()
    .single();

  if (errorEvento) throw errorEvento;

  // Si NO es visible para todos, crear permisos específicos
  if (!filtrosPermiso.visible_para_todos) {
    const permisos: any[] = [];

    // Agregar permisos por rol
    if (filtrosPermiso.roles && filtrosPermiso.roles.length > 0) {
      filtrosPermiso.roles.forEach(rol => {
        permisos.push({
          evento_id: eventoCreado.id,
          rol: rol
        });
      });
    }

    // Agregar permisos por oficina
    if (filtrosPermiso.oficinas && filtrosPermiso.oficinas.length > 0) {
      filtrosPermiso.oficinas.forEach(oficinaId => {
        permisos.push({
          evento_id: eventoCreado.id,
          oficina_id: oficinaId
        });
      });
    }

    // Agregar permisos por usuario
    if (filtrosPermiso.usuarios && filtrosPermiso.usuarios.length > 0) {
      filtrosPermiso.usuarios.forEach(usuarioId => {
        permisos.push({
          evento_id: eventoCreado.id,
          usuario_id: usuarioId
        });
      });
    }

    // Insertar permisos
    if (permisos.length > 0) {
      const { error: errorPermisos } = await supabase
        .from('aula_eventos_permisos')
        .insert(permisos);

      if (errorPermisos) throw errorPermisos;
    }
  }

  // Obtener usuarios autorizados para notificar
  const { data: usuariosAutorizados, error: errorUsuarios } = await supabase
    .rpc('obtener_usuarios_con_permiso_evento', { evento_uuid: eventoCreado.id });

  if (errorUsuarios) {
    console.error('Error obteniendo usuarios autorizados:', errorUsuarios);
  } else if (usuariosAutorizados && usuariosAutorizados.length > 0) {
    // Enviar notificaciones por TODOS los canales (correo, WhatsApp, campanita)
    const linkEvento = `/seguros-education-aula-digital?evento=${eventoCreado.id}`;

    for (const usuario of usuariosAutorizados) {
      try {
        await supabase.rpc('enviar_notificacion_completa', {
          p_tipo_codigo: 'nuevo_evento',
          p_user_id: usuario.usuario_id,
          p_titulo: `Nuevo evento: ${evento.titulo}`,
          p_mensaje: `Se ha programado un nuevo evento en Aula Digital.`,
          p_modulo: 'Seguros Education',
          p_datos_adicionales: {
            titulo_evento: evento.titulo,
            descripcion_evento: evento.descripcion,
            ponente: evento.ponente,
            fecha_evento: evento.fecha,
            hora_evento: evento.hora,
            link_evento: linkEvento,
            link_sesion: evento.link_sesion
          },
          p_accion_url: linkEvento
        });
      } catch (error) {
        console.error(`Error enviando notificación a usuario ${usuario.usuario_id}:`, error);
      }
    }
  }

  return eventoCreado.id;
}

// Actualizar evento
export async function actualizarEvento(
  id: string,
  evento: Partial<Omit<AulaEvento, 'id' | 'creado_por' | 'creado_en' | 'modificado_en'>>,
  filtrosPermiso?: FiltrosPermiso
): Promise<void> {
  // Actualizar evento
  const { error: errorEvento } = await supabase
    .from('aula_eventos')
    .update({
      ...evento,
      visible_para_todos: filtrosPermiso?.visible_para_todos || false
    })
    .eq('id', id);

  if (errorEvento) throw errorEvento;

  // Si se proporcionan nuevos permisos, actualizar
  if (filtrosPermiso) {
    // Eliminar permisos anteriores
    const { error: errorEliminar } = await supabase
      .from('aula_eventos_permisos')
      .delete()
      .eq('evento_id', id);

    if (errorEliminar) throw errorEliminar;

    // Si NO es visible para todos, crear nuevos permisos
    if (!filtrosPermiso.visible_para_todos) {
      const permisos: any[] = [];

      // Agregar permisos por rol
      if (filtrosPermiso.roles && filtrosPermiso.roles.length > 0) {
        filtrosPermiso.roles.forEach(rol => {
          permisos.push({
            evento_id: id,
            rol: rol
          });
        });
      }

      // Agregar permisos por oficina
      if (filtrosPermiso.oficinas && filtrosPermiso.oficinas.length > 0) {
        filtrosPermiso.oficinas.forEach(oficinaId => {
          permisos.push({
            evento_id: id,
            oficina_id: oficinaId
          });
        });
      }

      // Agregar permisos por usuario
      if (filtrosPermiso.usuarios && filtrosPermiso.usuarios.length > 0) {
        filtrosPermiso.usuarios.forEach(usuarioId => {
          permisos.push({
            evento_id: id,
            usuario_id: usuarioId
          });
        });
      }

      // Insertar nuevos permisos
      if (permisos.length > 0) {
        const { error: errorPermisos } = await supabase
          .from('aula_eventos_permisos')
          .insert(permisos);

        if (errorPermisos) throw errorPermisos;
      }
    }
  }
}

// Eliminar evento
export async function eliminarEvento(id: string): Promise<void> {
  const { error } = await supabase
    .from('aula_eventos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Obtener evento con permisos detallados (solo admin)
export async function obtenerEventoConPermisos(id: string): Promise<EventoConPermisos | null> {
  const evento = await obtenerEvento(id);
  if (!evento) return null;

  const permisos = await obtenerPermisosEvento(id);

  // Obtener total de usuarios con permiso
  const { data: usuariosAutorizados } = await supabase
    .rpc('obtener_usuarios_con_permiso_evento', { evento_uuid: id });

  return {
    ...evento,
    permisos,
    total_usuarios_con_permiso: usuariosAutorizados?.length || 0
  };
}

// Verificar si el evento es futuro
export function esEventoFuturo(fecha: string, hora: string): boolean {
  const ahora = new Date();
  const fechaEvento = new Date(`${fecha}T${hora}`);
  return fechaEvento > ahora;
}

// Verificar si el evento es hoy y está por comenzar (en las próximas 2 horas)
export function eventoPorComenzar(fecha: string, hora: string): boolean {
  const ahora = new Date();
  const fechaEvento = new Date(`${fecha}T${hora}`);
  const diferenciaMilisegundos = fechaEvento.getTime() - ahora.getTime();
  const diferenciaHoras = diferenciaMilisegundos / (1000 * 60 * 60);

  return diferenciaHoras > 0 && diferenciaHoras <= 2;
}

// Obtener texto de fecha formateado
export function formatearFechaEvento(fecha: string): string {
  const fechaObj = new Date(fecha + 'T00:00:00');
  const opciones: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return fechaObj.toLocaleDateString('es-ES', opciones);
}

// Obtener texto de hora formateado
export function formatearHoraEvento(hora: string): string {
  const [horas, minutos] = hora.split(':');
  return `${horas}:${minutos}`;
}
