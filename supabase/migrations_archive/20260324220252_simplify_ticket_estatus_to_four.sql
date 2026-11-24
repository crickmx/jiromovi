/*
  # Simplificar Estatus a Solo 4 Estados

  1. Problema
    - Demasiados estatus que no se necesitan
    - Solo se requieren: Iniciado, En Proceso, Emitido, No Emitido

  2. Solución
    - Desactivar estatus no necesarios: Nuevo, En espera, Resuelto, Cerrado
    - Migrar tickets existentes a estatus apropiados
    - Mantener solo los 4 estatus esenciales activos

  3. Estatus Finales
    - Iniciado (orden 1)
    - En Proceso (orden 2)
    - Emitido (orden 3)
    - No Emitido (orden 4)

  4. Migración de Datos
    - Nuevo → Iniciado
    - En espera → En Proceso
    - Resuelto → Emitido (si es cotización) o En Proceso (otros casos)
    - Cerrado → Emitido (si está completado exitosamente)
*/

-- Paso 1: Obtener IDs de los estatus que queremos mantener
DO $$
DECLARE
  estatus_iniciado_id uuid;
  estatus_en_proceso_id uuid;
  estatus_emitido_id uuid;
  estatus_no_emitido_id uuid;
  estatus_nuevo_id uuid;
  estatus_en_espera_id uuid;
  estatus_resuelto_id uuid;
  estatus_cerrado_id uuid;
BEGIN
  -- Obtener IDs de estatus a mantener
  SELECT id INTO estatus_iniciado_id FROM ticket_estatus WHERE nombre = 'Iniciado' AND activo = true;
  SELECT id INTO estatus_en_proceso_id FROM ticket_estatus WHERE nombre = 'En Proceso' AND activo = true;
  SELECT id INTO estatus_emitido_id FROM ticket_estatus WHERE nombre = 'Emitido' AND activo = true;
  SELECT id INTO estatus_no_emitido_id FROM ticket_estatus WHERE nombre = 'No Emitido' AND activo = true;

  -- Obtener IDs de estatus a desactivar
  SELECT id INTO estatus_nuevo_id FROM ticket_estatus WHERE nombre = 'Nuevo' AND activo = true;
  SELECT id INTO estatus_en_espera_id FROM ticket_estatus WHERE nombre = 'En espera' AND activo = true;
  SELECT id INTO estatus_resuelto_id FROM ticket_estatus WHERE nombre = 'Resuelto' AND activo = true;
  SELECT id INTO estatus_cerrado_id FROM ticket_estatus WHERE nombre = 'Cerrado' AND activo = true;

  -- Migrar tickets con estatus "Nuevo" → "Iniciado"
  IF estatus_nuevo_id IS NOT NULL AND estatus_iniciado_id IS NOT NULL THEN
    UPDATE tickets 
    SET estatus_id = estatus_iniciado_id 
    WHERE estatus_id = estatus_nuevo_id;
    
    RAISE NOTICE 'Migrados tickets de "Nuevo" a "Iniciado"';
  END IF;

  -- Migrar tickets con estatus "En espera" → "En Proceso"
  IF estatus_en_espera_id IS NOT NULL AND estatus_en_proceso_id IS NOT NULL THEN
    UPDATE tickets 
    SET estatus_id = estatus_en_proceso_id 
    WHERE estatus_id = estatus_en_espera_id;
    
    RAISE NOTICE 'Migrados tickets de "En espera" a "En Proceso"';
  END IF;

  -- Migrar tickets con estatus "Resuelto" → "Emitido" (si cerrado_en no es null) o "En Proceso"
  IF estatus_resuelto_id IS NOT NULL AND estatus_emitido_id IS NOT NULL AND estatus_en_proceso_id IS NOT NULL THEN
    -- Tickets cerrados exitosamente → Emitido
    UPDATE tickets 
    SET estatus_id = estatus_emitido_id 
    WHERE estatus_id = estatus_resuelto_id 
      AND cerrado_en IS NOT NULL;
    
    -- Tickets aún abiertos → En Proceso
    UPDATE tickets 
    SET estatus_id = estatus_en_proceso_id 
    WHERE estatus_id = estatus_resuelto_id 
      AND cerrado_en IS NULL;
    
    RAISE NOTICE 'Migrados tickets de "Resuelto"';
  END IF;

  -- Migrar tickets con estatus "Cerrado" → "Emitido"
  IF estatus_cerrado_id IS NOT NULL AND estatus_emitido_id IS NOT NULL THEN
    UPDATE tickets 
    SET estatus_id = estatus_emitido_id 
    WHERE estatus_id = estatus_cerrado_id;
    
    RAISE NOTICE 'Migrados tickets de "Cerrado" a "Emitido"';
  END IF;

  -- Desactivar estatus no necesarios
  UPDATE ticket_estatus 
  SET activo = false 
  WHERE nombre IN ('Nuevo', 'En espera', 'Resuelto', 'Cerrado');
  
  RAISE NOTICE 'Desactivados estatus innecesarios';

  -- Reorganizar orden de los 4 estatus activos
  UPDATE ticket_estatus SET orden = 1 WHERE nombre = 'Iniciado' AND activo = true;
  UPDATE ticket_estatus SET orden = 2 WHERE nombre = 'En Proceso' AND activo = true;
  UPDATE ticket_estatus SET orden = 3 WHERE nombre = 'Emitido' AND activo = true;
  UPDATE ticket_estatus SET orden = 4 WHERE nombre = 'No Emitido' AND activo = true;
  
  RAISE NOTICE 'Reorganizados órdenes de estatus activos';

  -- Actualizar tipo_aplicable para los 4 estatus
  UPDATE ticket_estatus 
  SET tipo_aplicable = ARRAY['general', 'registro_actividad', 'solicitud_comisiones', 'cambio_bancario'] 
  WHERE nombre IN ('Iniciado', 'En Proceso', 'Emitido', 'No Emitido') AND activo = true;
  
  RAISE NOTICE 'Actualizados tipos aplicables';

END $$;

-- Verificar resultado final
DO $$
DECLARE
  total_activos int;
BEGIN
  SELECT COUNT(*) INTO total_activos FROM ticket_estatus WHERE activo = true;
  RAISE NOTICE 'Total de estatus activos: %', total_activos;
  
  IF total_activos != 4 THEN
    RAISE WARNING 'Se esperaban 4 estatus activos, pero hay %', total_activos;
  END IF;
END $$;
