/*
  # Unificar Estatus de Trámites

  1. Problema
    - Existen estatus duplicados y desorganizados
    - "En proceso" (minúsculas) vs "En Proceso" (mayúsculas)
    - Estatus específicos para Cotización/Emisión mezclados con genéricos

  2. Solución
    - Consolidar en un conjunto unificado de estatus
    - Mantener compatibilidad con registros existentes
    - Ordenar de forma lógica por flujo de trabajo

  3. Estatus Finales (Unificados)
    - Nuevo (inicial)
    - Iniciado (cuando se comienza a trabajar)
    - En Proceso (en desarrollo activo)
    - En Espera (bloqueado/esperando información)
    - Emitido (específico para cotización exitosa)
    - No Emitido (específico para cotización fallida)
    - Resuelto (completado exitosamente)
    - Cerrado (finalizado)

  4. Cambios
    - Desactivar estatus duplicados
    - Actualizar referencias en tickets existentes
    - Reorganizar orden para flujo lógico
*/

-- Paso 1: Desactivar el estatus "En proceso" (minúsculas) duplicado
UPDATE ticket_estatus
SET activo = false
WHERE nombre = 'En proceso' AND color = '#f59e0b' AND orden = 2;

-- Paso 2: Actualizar tickets que usan "En proceso" a "En Proceso"
UPDATE tickets
SET estatus_id = (SELECT id FROM ticket_estatus WHERE nombre = 'En Proceso' AND activo = true LIMIT 1)
WHERE estatus_id = (SELECT id FROM ticket_estatus WHERE nombre = 'En proceso' AND activo = false LIMIT 1);

-- Paso 3: Reorganizar el orden de los estatus para flujo lógico
UPDATE ticket_estatus SET orden = 1 WHERE nombre = 'Nuevo' AND activo = true;
UPDATE ticket_estatus SET orden = 2 WHERE nombre = 'Iniciado' AND activo = true;
UPDATE ticket_estatus SET orden = 3 WHERE nombre = 'En Proceso' AND activo = true;
UPDATE ticket_estatus SET orden = 4 WHERE nombre = 'En espera' AND activo = true;
UPDATE ticket_estatus SET orden = 5 WHERE nombre = 'Emitido' AND activo = true;
UPDATE ticket_estatus SET orden = 6 WHERE nombre = 'No Emitido' AND activo = true;
UPDATE ticket_estatus SET orden = 7 WHERE nombre = 'Resuelto' AND activo = true;
UPDATE ticket_estatus SET orden = 8 WHERE nombre = 'Cerrado' AND activo = true;

-- Paso 4: Agregar campo tipo_aplicable para indicar qué estatus aplican a qué tipos de trámite
ALTER TABLE ticket_estatus
ADD COLUMN IF NOT EXISTS tipo_aplicable text[] DEFAULT ARRAY['general'];

-- Paso 5: Configurar tipos aplicables
UPDATE ticket_estatus SET tipo_aplicable = ARRAY['general', 'registro_actividad', 'solicitud_comisiones', 'cambio_bancario'] 
WHERE nombre IN ('Nuevo', 'Iniciado', 'En Proceso', 'En espera', 'Resuelto', 'Cerrado');

UPDATE ticket_estatus SET tipo_aplicable = ARRAY['registro_actividad'] 
WHERE nombre IN ('Emitido', 'No Emitido');

-- Paso 6: Agregar comentario descriptivo
COMMENT ON COLUMN ticket_estatus.tipo_aplicable IS 
'Indica a qué tipos de trámite aplica este estatus. Valores: general, registro_actividad, solicitud_comisiones, cambio_bancario';
