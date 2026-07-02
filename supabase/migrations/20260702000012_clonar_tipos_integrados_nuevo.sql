-- Clona los tipos de trámite INTEGRADOS (is_custom=false) como nuevos tipos
-- personalizables (is_custom=true) con el sufijo " NUEVO".
-- El trigger trigger_create_sistema_campos crea automáticamente los 7 campos sistema.
-- Luego se copian los campos custom (no-sistema) de cada tipo original.

DO $$
DECLARE
  v_orig   RECORD;
  v_nuevo_id uuid;
  v_campo  RECORD;
  v_max_orden integer;
BEGIN

  -- Lista de tipos INTEGRADOS a clonar (los visibles en la UI)
  FOR v_orig IN
    SELECT id, value, label, area, color, orden
    FROM ticket_tipos
    WHERE is_custom = false
      AND activo    = true
      AND value IN (
        'cotizacion_emision',
        'correccion_poliza_endoso',
        'renovaciones',
        'cobranza',
        'otros_comercial',
        'formulario_cotizacion',
        'correccion_poliza_registrada',
        'correccion_comisiones',
        'registro_poliza',
        'solicitud_comisiones_pendientes',
        'cambio_bancario',
        'cancelacion_poliza'
      )
  LOOP
    -- Saltar si ya existe el clon NUEVO
    IF EXISTS (
      SELECT 1 FROM ticket_tipos WHERE value = v_orig.value || '_nuevo'
    ) THEN
      CONTINUE;
    END IF;

    -- Obtener el máximo orden actual para poner el nuevo al final
    SELECT COALESCE(MAX(orden), 0) INTO v_max_orden FROM ticket_tipos;

    -- Insertar el tipo NUEVO (el trigger crea los campos sistema automáticamente)
    INSERT INTO ticket_tipos (value, label, area, color, orden, is_custom, activo)
    VALUES (
      v_orig.value || '_nuevo',
      v_orig.label || ' NUEVO',
      v_orig.area,
      v_orig.color,
      v_max_orden + 1,
      true,
      true
    )
    RETURNING id INTO v_nuevo_id;

    -- Copiar campos custom (no-sistema) del original al nuevo tipo
    FOR v_campo IN
      SELECT key, label, tipo, requerido, ayuda, display_order, config,
             visible_para_rol, editable_para_rol
      FROM tramite_tipo_campos
      WHERE tramite_tipo_id = v_orig.id
        AND is_sistema = false
        AND activo     = true
      ORDER BY display_order
    LOOP
      INSERT INTO tramite_tipo_campos (
        tramite_tipo_id, key, label, tipo, requerido, ayuda,
        display_order, config, activo, is_sistema, sistema_key,
        visible_para_rol, editable_para_rol
      ) VALUES (
        v_nuevo_id,
        v_campo.key,
        v_campo.label,
        v_campo.tipo,
        v_campo.requerido,
        v_campo.ayuda,
        v_campo.display_order,
        v_campo.config,
        true,
        false,
        NULL,
        COALESCE(v_campo.visible_para_rol,  'todos'),
        COALESCE(v_campo.editable_para_rol, 'todos')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

  END LOOP;
END;
$$;
