/*
  # Eliminar Índices Duplicados

  1. Propósito
    - Eliminar índices duplicados que consumen espacio innecesario
    - Mejorar rendimiento de escritura
    - Reducir overhead de mantenimiento

  2. Índices a Eliminar
    - Se eliminan 6 índices duplicados
    - Se mantiene solo uno de cada par duplicado

  3. Impacto
    - Libera espacio en disco
    - Mejora rendimiento de INSERT/UPDATE
    - Sin impacto en queries (el índice restante cubre las mismas necesidades)
*/

-- Eliminar índices duplicados manteniendo el más descriptivo

-- chat_miembros: mantener idx_chat_miembros_usuario_chat, eliminar idx_chat_miembros_usuario
DROP INDEX IF EXISTS idx_chat_miembros_usuario;

-- crm_cotizaciones: mantener idx_crm_cotizaciones_contacto_id, eliminar idx_crm_cotizaciones_contacto
DROP INDEX IF EXISTS idx_crm_cotizaciones_contacto;

-- crm_notas: mantener idx_crm_notas_contacto_id, eliminar idx_crm_notas_contacto
DROP INDEX IF EXISTS idx_crm_notas_contacto;

-- crm_polizas: mantener idx_crm_polizas_contacto_id, eliminar idx_crm_polizas_contacto
DROP INDEX IF EXISTS idx_crm_polizas_contacto;

-- crm_tareas: mantener idx_crm_tareas_contacto_id, eliminar idx_crm_tareas_contacto
DROP INDEX IF EXISTS idx_crm_tareas_contacto;

-- solicitudes_vacaciones: mantener idx_solicitudes_vacaciones_gerente_id, eliminar idx_solicitudes_vacaciones_administrador_id
DROP INDEX IF EXISTS idx_solicitudes_vacaciones_administrador_id;