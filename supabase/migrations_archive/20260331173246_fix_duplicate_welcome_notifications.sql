/*
  # Fix: Eliminar Duplicación de Notificaciones de Bienvenida
  
  ## Problema Identificado
  Las notificaciones de bienvenida se enviaban 2 veces por WhatsApp (y otros canales):
  1. El edge function `create-user` llamaba manualmente a `enviar_notificacion_completa` (línea 248)
  2. El trigger `trigger_send_welcome_on_create` también se disparaba en INSERT
  
  Resultado: Cada usuario recibía notificaciones duplicadas en todos los canales habilitados.
  
  ## Solución
  1. Eliminar el trigger `trigger_send_welcome_on_create` que se dispara en INSERT
  2. Eliminar la función `send_welcome_on_user_create` que ya no se necesita
  3. Mantener solo la función `send_welcome_on_user_activation` para cuando un gerente activa usuarios
  4. El edge function seguirá enviando notificaciones manualmente cuando crea usuarios activos
  
  ## Cambios
  - DROP TRIGGER trigger_send_welcome_on_create
  - DROP FUNCTION send_welcome_on_user_create
  - MANTENER: send_welcome_on_user_activation (solo para cambio de estado pendiente -> activo)
  
  ## Resultado
  - Usuario creado como activo por admin → 1 notificación (desde edge function)
  - Usuario creado como pendiente por gerente → 0 notificaciones
  - Usuario activado (pendiente → activo) → 1 notificación (desde trigger de UPDATE)
*/

-- Eliminar el trigger que causa duplicación en INSERT
DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;

-- Eliminar la función que ya no se necesita
DROP FUNCTION IF EXISTS send_welcome_on_user_create();

-- Verificar que la función de activación sigue existiendo
-- (No la eliminamos porque sigue siendo útil para cuando un gerente activa un usuario)
COMMENT ON FUNCTION send_welcome_on_user_activation IS
  '[FIX] Envía notificaciones solo cuando se activa un usuario que estaba pendiente o inactivo. 
  NO se dispara en INSERT, solo en UPDATE cuando estado cambia a activo.
  Evita duplicación con el edge function create-user que envía notificaciones manualmente para usuarios activos.';

-- Log de la corrección
DO $$
BEGIN
  RAISE NOTICE '✅ Fix aplicado: Eliminado trigger_send_welcome_on_create para evitar duplicación de notificaciones';
  RAISE NOTICE '✅ El edge function create-user sigue enviando notificaciones para usuarios creados como activos';
  RAISE NOTICE '✅ El trigger de activación sigue funcionando para usuarios pendientes que son activados';
END $$;
