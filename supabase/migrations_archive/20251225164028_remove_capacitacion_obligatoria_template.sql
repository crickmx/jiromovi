/*
  # Eliminar plantilla de Capacitación Obligatoria

  1. Eliminación
    - Elimina el tipo de notificación 'capacitacion_obligatoria'
    - Las plantillas asociadas se eliminan automáticamente por CASCADE

  2. Notas
    - Esta plantilla no se estaba usando en el sistema
    - Solo se usa 'nuevo_evento' para todos los eventos del Aula Digital
*/

-- Eliminar el tipo de notificación (esto eliminará automáticamente las plantillas asociadas)
DELETE FROM correo_tipos_notificacion
WHERE codigo = 'capacitacion_obligatoria';
