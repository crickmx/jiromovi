/*
  # Corregir notificaciones automáticas vs departamentales
  
  1. Problema
    - Varias notificaciones están marcadas como departamentales cuando deben ser automáticas
    - Solo 6 notificaciones deben requerir destinatarios custom
  
  2. Solución
    - Marcar como FALSE (automáticas):
      * cancelacion_evento: se envía a participantes del evento
      * nuevo_evento: se envía a todos los usuarios
      * recordatorio_evento: se envía a participantes del evento
    
    - Mantener como TRUE (departamentales):
      * vacaciones_aprobadas: RRHH
      * solicitud_compra_store: Mercadotecnia
      * nuevo_tramite: Mesa de Control
      * solicitud_correccion_comisiones: Mesa de Control
      * nuevo_usuario_creado: Equipos internos (RRHH/Mercadotecnia/Mesa Control)
      * notificacion_personalizada: Notificaciones manuales del admin
*/

-- Corregir notificaciones de eventos (deben ser automáticas)
UPDATE correo_tipos_notificacion
SET 
  permite_destinatarios_custom = false,
  descripcion = 'Se envía automáticamente cuando se cancela un evento a todos los participantes inscritos.'
WHERE codigo = 'cancelacion_evento';

UPDATE correo_tipos_notificacion
SET 
  permite_destinatarios_custom = false,
  descripcion = 'Se envía automáticamente a todos los usuarios cuando se publica un nuevo evento en Seguros Education.'
WHERE codigo = 'nuevo_evento';

UPDATE correo_tipos_notificacion
SET 
  permite_destinatarios_custom = false,
  descripcion = 'Se envía automáticamente como recordatorio a los participantes inscritos en un evento próximo.'
WHERE codigo = 'recordatorio_evento';

-- Actualizar descripciones de las departamentales correctas
UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica a RRHH cuando se aprueban vacaciones de un empleado. Para seguimiento y gestión de ausencias.'
WHERE codigo = 'vacaciones_aprobadas';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica al equipo de Mercadotecnia cuando un usuario realiza un pedido en la Store. Para gestión de inventario y logística.'
WHERE codigo = 'solicitud_compra_store';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica a Mesa de Control cuando se genera un nuevo trámite (corrección de póliza, corrección de comisiones, registro, etc.).'
WHERE codigo = 'nuevo_tramite';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica a Mesa de Control cuando un usuario solicita corrección en un lote de comisiones.'
WHERE codigo = 'solicitud_correccion_comisiones';

UPDATE correo_tipos_notificacion
SET descripcion = '✅ Notifica a equipos internos (RRHH, Mercadotecnia, Mesa de Control) cuando se crea un nuevo usuario. Para seguimiento comercial y activación de campañas.'
WHERE codigo = 'nuevo_usuario_creado';

UPDATE correo_tipos_notificacion
SET descripcion = 'Notificación personalizada creada manualmente por un administrador para enviar a usuarios específicos.'
WHERE codigo = 'notificacion_personalizada';

-- Verificar resultado
DO $$
DECLARE
  v_count_departamentales int;
  v_count_automaticas int;
  v_rec record;
BEGIN
  SELECT COUNT(*) INTO v_count_departamentales
  FROM correo_tipos_notificacion
  WHERE permite_destinatarios_custom = true AND activo = true;
  
  SELECT COUNT(*) INTO v_count_automaticas
  FROM correo_tipos_notificacion
  WHERE permite_destinatarios_custom = false AND activo = true;
  
  RAISE NOTICE '✅ Notificaciones departamentales activas: %', v_count_departamentales;
  RAISE NOTICE '✅ Notificaciones automáticas activas: %', v_count_automaticas;
  
  -- Mostrar las departamentales
  RAISE NOTICE '--- Notificaciones DEPARTAMENTALES (requieren destinatarios) ---';
  FOR v_rec IN 
    SELECT codigo, nombre 
    FROM correo_tipos_notificacion 
    WHERE permite_destinatarios_custom = true AND activo = true
    ORDER BY nombre
  LOOP
    RAISE NOTICE '  - % (%)', v_rec.nombre, v_rec.codigo;
  END LOOP;
END $$;