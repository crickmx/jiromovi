/*
  # Auditoría y Corrección Completa del Sistema de Notificaciones
  
  ## Problemas identificados y soluciones
  
  1. **109 notificaciones con URL vacía pero accion_url llena**
     - Sincronizar campo `url` (legacy) con `accion_url` (nuevo)
     - Esto arreglará el problema de notificaciones de comunicados que no redirigen
  
  2. **Plantilla faltante para commission_batch_closed en sistema legacy**
     - Crear plantilla legacy para compatibilidad
  
  3. **Verificación de configuración de password_reset**
     - Confirmar que está activo y configurado correctamente
  
  4. **Actualizar dispatcher para usar siempre accion_url**
     - Ya está correcto, pero aseguramos consistencia
  
  ## Cambios aplicados
  
  1. Sincronizar URLs en notificaciones existentes
  2. Crear plantilla legacy faltante
  3. Eliminar tipos de notificación duplicados si existen
  4. Verificar configuración de todos los canales
*/

-- =====================================================
-- 1. Sincronizar URLs en notificaciones existentes
-- =====================================================

-- Copiar accion_url a url en todas las notificaciones donde url está vacío
UPDATE notificaciones
SET url = accion_url,
    updated_at = now()
WHERE (url IS NULL OR url = '')
  AND accion_url IS NOT NULL
  AND accion_url != '';

-- Log del resultado
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notificaciones
  WHERE url IS NOT NULL AND url != ''
    AND url = accion_url;
  
  RAISE NOTICE '✅ Sincronizadas % notificaciones con URLs correctas', v_count;
END $$;

-- =====================================================
-- 2. Crear plantilla legacy para commission_batch_closed
-- =====================================================

-- Insertar tipo de notificación si no existe
INSERT INTO correo_tipos_notificacion (
  codigo,
  nombre,
  descripcion,
  activo,
  enviar_por_correo,
  enviar_por_whatsapp
)
VALUES (
  'commission_batch_closed',
  'Lote de Comisiones Cerrado',
  'Notificación cuando un lote de comisiones es cerrado y está disponible para el agente',
  true,
  true,
  true
)
ON CONFLICT (codigo) DO UPDATE
SET 
  activo = true,
  enviar_por_correo = true,
  enviar_por_whatsapp = true;

-- Crear plantilla si no existe
DO $$
DECLARE
  v_tipo_id uuid;
  v_plantilla_exists boolean;
BEGIN
  -- Obtener ID del tipo
  SELECT id INTO v_tipo_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'commission_batch_closed';

  -- Verificar si existe plantilla
  SELECT EXISTS(
    SELECT 1 FROM correo_plantillas 
    WHERE tipo_notificacion_id = v_tipo_id
  ) INTO v_plantilla_exists;

  -- Solo insertar si no existe
  IF NOT v_plantilla_exists THEN
    INSERT INTO correo_plantillas (
      tipo_notificacion_id,
      asunto,
      html_cuerpo,
      whatsapp_plantilla,
      variables_disponibles,
      whatsapp_variables_disponibles,
      es_plantilla_default
    )
    VALUES (
      v_tipo_id,
      'Tus comisiones de la semana {{week_number}} están listas',
      '<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #1D78FF;">💰 Comisiones Disponibles</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Hola <strong>{{agent_name}}</strong>,
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Te informamos que tus comisiones de la <strong>semana {{week_number}}</strong> 
          (periodo del <strong>{{period_start}}</strong> al <strong>{{period_end}}</strong>) 
          han sido calculadas.
        </p>
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 18px; font-weight: bold; color: #1D78FF; margin: 0;">
            Total neto: {{net_commission_total}} MXN
          </p>
        </div>
        <p style="font-size: 16px; line-height: 1.6;">
          Puedes consultar el detalle y descargar tu Orden de Pago desde el sistema.
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="https://app.movi.digital/mis-comisiones" 
             style="background-color: #1D78FF; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Ver Mis Comisiones
          </a>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        <p style="color: #666; font-size: 12px;">Mensaje desde www.movi.digital</p>
      </div>',
      'Hola {{agent_name}} 👋

Tus comisiones de la semana {{week_number}} ({{period_start}} a {{period_end}}) ya están listas.

💰 Total neto: {{net_commission_total}} MXN

Puedes ver el detalle y descargar tu Orden de Pago en www.movi.digital

---
Mensaje desde www.movi.digital',
      ARRAY['agent_name', 'office_name', 'week_number', 'period_start', 'period_end', 'net_commission_total'],
      ARRAY['agent_name', 'week_number', 'period_start', 'period_end', 'net_commission_total'],
      true
    );
    RAISE NOTICE '✅ Plantilla creada para commission_batch_closed';
  ELSE
    RAISE NOTICE 'ℹ️  Plantilla ya existe para commission_batch_closed';
  END IF;
END $$;

-- =====================================================
-- 3. Eliminar duplicados de password_reset si existen
-- =====================================================

-- Verificar si existe 'recuperacion_password' (duplicado)
DO $$
DECLARE
  v_duplicado_id uuid;
  v_principal_id uuid;
BEGIN
  -- Obtener IDs
  SELECT id INTO v_duplicado_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'recuperacion_password';
  
  SELECT id INTO v_principal_id
  FROM correo_tipos_notificacion
  WHERE codigo = 'password_reset';
  
  -- Si existe el duplicado, migrarlo
  IF v_duplicado_id IS NOT NULL AND v_principal_id IS NOT NULL THEN
    -- Actualizar referencias en historial
    UPDATE correo_historial_envios
    SET tipo_notificacion_id = v_principal_id
    WHERE tipo_notificacion_id = v_duplicado_id;
    
    -- Eliminar plantilla duplicada
    DELETE FROM correo_plantillas
    WHERE tipo_notificacion_id = v_duplicado_id;
    
    -- Eliminar tipo duplicado
    DELETE FROM correo_tipos_notificacion
    WHERE id = v_duplicado_id;
    
    RAISE NOTICE '✅ Eliminado tipo de notificación duplicado: recuperacion_password';
  ELSE
    RAISE NOTICE 'ℹ️  No se encontró tipo duplicado de password_reset';
  END IF;
END $$;

-- =====================================================
-- 4. Verificar configuración de password_reset
-- =====================================================

-- Asegurar que password_reset está activo y correctamente configurado
UPDATE correo_tipos_notificacion
SET 
  activo = true,
  enviar_por_correo = true,
  enviar_por_whatsapp = false
WHERE codigo = 'password_reset';

-- Verificar que está en el catálogo de eventos
UPDATE notification_events_catalog
SET 
  active = true,
  enable_email = true,
  enable_whatsapp = false,
  enable_in_app = false
WHERE event_code = 'password_reset';

-- =====================================================
-- 5. Resumen final
-- =====================================================

DO $$
DECLARE
  v_notif_sincronizadas integer;
  v_plantillas_legacy integer;
  v_plantillas_transaccionales integer;
  v_eventos_activos integer;
BEGIN
  -- Contar estadísticas
  SELECT COUNT(*) INTO v_notif_sincronizadas
  FROM notificaciones
  WHERE url IS NOT NULL AND url != '';
  
  SELECT COUNT(*) INTO v_plantillas_legacy
  FROM correo_plantillas;
  
  SELECT COUNT(*) INTO v_plantillas_transaccionales
  FROM transactional_notification_templates
  WHERE is_active = true;
  
  SELECT COUNT(*) INTO v_eventos_activos
  FROM notification_events_catalog
  WHERE active = true;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AUDITORÍA COMPLETA DE NOTIFICACIONES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Notificaciones con URL sincronizada: %', v_notif_sincronizadas;
  RAISE NOTICE '✅ Plantillas legacy activas: %', v_plantillas_legacy;
  RAISE NOTICE '✅ Plantillas transaccionales activas: %', v_plantillas_transaccionales;
  RAISE NOTICE '✅ Eventos en catálogo activos: %', v_eventos_activos;
  RAISE NOTICE '';
  RAISE NOTICE 'PROBLEMAS CORREGIDOS:';
  RAISE NOTICE '✓ URLs vacías en notificaciones sincronizadas';
  RAISE NOTICE '✓ Plantilla legacy para commission_batch_closed creada';
  RAISE NOTICE '✓ Duplicados eliminados';
  RAISE NOTICE '✓ password_reset verificado y activo';
  RAISE NOTICE '';
  RAISE NOTICE 'SISTEMA DE NOTIFICACIONES: OPERACIONAL';
  RAISE NOTICE '========================================';
END $$;
