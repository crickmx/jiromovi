/*
  # Corregir trigger de actualización en tickets

  ## Descripción
  Elimina el trigger problemático que intenta actualizar una columna 'updated_at'
  que no existe. La tabla usa 'ultima_modificacion' que ya se actualiza con
  otro trigger (update_ticket_modificacion).

  ## Cambios
  - Elimina trigger trigger_tickets_updated_at que causa error
  - El trigger update_ticket_modificacion ya maneja la actualización correctamente

  ## Seguridad
  - No afecta las políticas RLS
*/

-- Eliminar el trigger problemático
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON tickets;

-- Verificar que el trigger correcto existe
-- Este trigger actualiza ultima_modificacion correctamente
