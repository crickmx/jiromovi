/*
  # Eliminar Políticas RLS Duplicadas

  1. Propósito
    - Eliminar políticas RLS duplicadas
    - Simplificar gestión de seguridad
    - Mejorar rendimiento de queries

  2. Impacto
    - Reduce overhead de evaluación de políticas
    - Mantiene la misma funcionalidad de seguridad
    - Facilita mantenimiento

  3. Estrategia
    - Se eliminan políticas antiguas o redundantes
    - Se mantienen las políticas más descriptivas
*/

-- aula_eventos: eliminar políticas antiguas duplicadas
DROP POLICY IF EXISTS "Administradores eliminan eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores crean eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores ven todos los eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Administradores actualizan eventos" ON aula_eventos;
DROP POLICY IF EXISTS "Usuarios ven eventos autorizados" ON aula_eventos;

-- aula_eventos_permisos: eliminar duplicadas
DROP POLICY IF EXISTS "Administradores eliminan permisos" ON aula_eventos_permisos;
DROP POLICY IF EXISTS "Administradores crean permisos" ON aula_eventos_permisos;
DROP POLICY IF EXISTS "Administradores ven todos los permisos" ON aula_eventos_permisos;

-- seguros_categories: eliminar política redundante
DROP POLICY IF EXISTS "seguros_categories_all_policy" ON seguros_categories;
DROP POLICY IF EXISTS "seguros_categories_select_policy" ON seguros_categories;

-- seguros_sessions: eliminar política redundante
DROP POLICY IF EXISTS "seguros_sessions_select_policy" ON seguros_sessions;

-- solicitudes_vacaciones: eliminar políticas antiguas
DROP POLICY IF EXISTS "Crear solicitudes de vacaciones" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_insert_policy" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_select_policy" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "vacaciones_update_policy" ON solicitudes_vacaciones;

-- reservas_espacio: eliminar políticas antiguas
DROP POLICY IF EXISTS "Crear reservas" ON reservas_espacio;
DROP POLICY IF EXISTS "reservas_insert_policy" ON reservas_espacio;
DROP POLICY IF EXISTS "reservas_select_policy" ON reservas_espacio;
DROP POLICY IF EXISTS "reservas_update_policy" ON reservas_espacio;

-- contactos: eliminar políticas antiguas
DROP POLICY IF EXISTS "Crear contactos" ON contactos;
DROP POLICY IF EXISTS "contactos_delete_policy" ON contactos;
DROP POLICY IF EXISTS "contactos_insert_policy" ON contactos;
DROP POLICY IF EXISTS "contactos_select_policy" ON contactos;
DROP POLICY IF EXISTS "contactos_update_policy" ON contactos;

-- meetings: eliminar políticas antiguas
DROP POLICY IF EXISTS "Crear meetings" ON meetings;
DROP POLICY IF EXISTS "Ver meetings donde participo" ON meetings;
DROP POLICY IF EXISTS "Actualizar meetings propios" ON meetings;

-- notificaciones: eliminar políticas antiguas
DROP POLICY IF EXISTS "Ver notificaciones propias" ON notificaciones;
DROP POLICY IF EXISTS "Actualizar notificaciones propias" ON notificaciones;
DROP POLICY IF EXISTS "Eliminar notificaciones propias" ON notificaciones;

-- notificaciones_globales: eliminar políticas redundantes
DROP POLICY IF EXISTS "Ver notificaciones globales" ON notificaciones_globales;
DROP POLICY IF EXISTS "notificaciones_globales_select_policy" ON notificaciones_globales;
DROP POLICY IF EXISTS "notificaciones_globales_insert_policy" ON notificaciones_globales;

-- usuarios: eliminar políticas redundantes
DROP POLICY IF EXISTS "usuarios_delete_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;