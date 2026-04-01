/*
  # Corregir formato de teléfono WhatsApp a +521

  1. Cambios
    - Actualizar función normalize_phone_mx para usar +521 en lugar de +52
    - El formato correcto para celulares en México es +521 + 10 dígitos
    - Ejemplo: +5215512345678

  2. Impacto
    - Todos los mensajes de WhatsApp del sistema de notificaciones
    - Notificaciones transaccionales
    - Comunicados
    - Cualquier mensaje que use normalize_phone_mx
*/

-- =====================================================
-- Actualizar función normalize_phone_mx
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_phone_mx(p_phone text, p_log boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean text;
  v_result text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    IF p_log THEN
      INSERT INTO notification_phone_normalization_log (original_phone, success, error_reason)
      VALUES (p_phone, false, 'Empty or null phone');
    END IF;
    RETURN NULL;
  END IF;

  -- Remover espacios, guiones, paréntesis, puntos
  v_clean := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  -- Si empieza con +521, remover para procesar
  IF v_clean LIKE '+521%' THEN
    v_clean := substring(v_clean from 5);
  -- Si empieza con +52, remover para procesar
  ELSIF v_clean LIKE '+52%' THEN
    v_clean := substring(v_clean from 4);
  END IF;

  -- Si empieza con 521 y tiene 13 dígitos total, remover prefijo
  IF v_clean LIKE '521%' AND length(v_clean) = 13 THEN
    v_clean := substring(v_clean from 4);
  -- Si empieza con 52 y tiene 12 dígitos total, remover prefijo
  ELSIF v_clean LIKE '52%' AND length(v_clean) = 12 THEN
    v_clean := substring(v_clean from 3);
  END IF;

  -- Validar que tenga exactamente 10 dígitos
  IF length(v_clean) != 10 OR NOT (v_clean ~ '^[0-9]{10}$') THEN
    IF p_log THEN
      INSERT INTO notification_phone_normalization_log (original_phone, success, error_reason)
      VALUES (p_phone, false, 'Invalid format - must be 10 digits, got ' || length(v_clean) || ' digits');
    END IF;
    RETURN NULL;
  END IF;

  -- Retornar en formato E.164 para WhatsApp México: +521 + 10 dígitos
  v_result := '+521' || v_clean;

  IF p_log THEN
    INSERT INTO notification_phone_normalization_log (original_phone, normalized_phone, success)
    VALUES (p_phone, v_result, true);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION normalize_phone_mx IS 'Normaliza teléfonos mexicanos a formato E.164 para WhatsApp (+521XXXXXXXXXX)';

-- Logs
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORRECCIÓN FORMATO WHATSAPP +521';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Función normalize_phone_mx actualizada';
  RAISE NOTICE '✅ Ahora usa formato +521 + 10 dígitos';
  RAISE NOTICE '✅ Ejemplo: +5215512345678';
  RAISE NOTICE '========================================';
END $$;
