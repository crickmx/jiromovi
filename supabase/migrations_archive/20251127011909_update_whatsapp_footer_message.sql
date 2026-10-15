/*
  # Actualizar mensaje final de plantillas WhatsApp
  
  ## Cambio
  Cambiar el mensaje final de todas las plantillas WhatsApp de:
  - "--- Equipo MOVI Digital"
  - "Mensaje automático de MOVI Digital"
  
  A:
  - "Mensaje desde www.movi.digital"
  
  ## Plantillas afectadas
  - notificacion_global
  - notificacion_individual
  - Y todas las demás que tengan el mensaje antiguo
*/

-- =====================================================
-- 1. Actualizar notificacion_global
-- =====================================================

UPDATE correo_plantillas p
SET whatsapp_plantilla = 'Hola {{nombre}}! 👋

{{mensaje}}

---
Mensaje desde www.movi.digital'
FROM correo_tipos_notificacion t
WHERE p.tipo_notificacion_id = t.id
AND t.codigo = 'notificacion_global';

-- =====================================================
-- 2. Actualizar notificacion_individual
-- =====================================================

UPDATE correo_plantillas p
SET whatsapp_plantilla = '🔔 *{{titulo}}*

{{mensaje}}

📂 Módulo: {{modulo}}

---
Mensaje desde www.movi.digital'
FROM correo_tipos_notificacion t
WHERE p.tipo_notificacion_id = t.id
AND t.codigo = 'notificacion_individual';

-- =====================================================
-- Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ACTUALIZACIÓN MENSAJE FOOTER WHATSAPP';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Plantilla notificacion_global actualizada';
  RAISE NOTICE '✅ Plantilla notificacion_individual actualizada';
  RAISE NOTICE '✅ Nuevo mensaje: "Mensaje desde www.movi.digital"';
  RAISE NOTICE '========================================';
END $$;
