/*
  # Funciones y Triggers para Sistema de Gamificación

  1. Funciones Principales
    - `fn_calcular_nivel`: Calcula nivel y rango según XP
    - `fn_calcular_multiplicador_veterano`: Calcula multiplicador por antigüedad
    - `fn_registrar_evento_gamificacion`: Registra evento y actualiza perfil
    - `fn_revertir_evento_gamificacion`: Revierte evento (cancelaciones)
    - `fn_procesar_expiracion_jc`: Expira Jiro Coins después de 6 meses
    - `fn_actualizar_progreso_mision`: Actualiza progreso de misiones
    - `fn_verificar_y_completar_misiones`: Verifica si se completaron misiones

  2. Triggers
    - Trigger para crear perfil automáticamente cuando un usuario es agente
    - Trigger para actualizar antigüedad anualmente
    - Trigger para verificar misiones al registrar eventos
*/

-- =====================================================
-- FUNCIÓN: Calcular nivel y rango según XP
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_nivel(xp_total INTEGER)
RETURNS TABLE(nivel INTEGER, rango TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT al.nivel, al.rango
  FROM agent_levels al
  WHERE xp_total >= al.xp_min
    AND (al.xp_max IS NULL OR xp_total <= al.xp_max)
  ORDER BY al.nivel DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN: Calcular multiplicador veterano
-- =====================================================

CREATE OR REPLACE FUNCTION fn_calcular_multiplicador_veterano(anios NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  -- 1.0 base + 0.02 por cada año
  RETURN 1.0 + (anios * 0.02);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FUNCIÓN: Registrar evento de gamificación
-- =====================================================

CREATE OR REPLACE FUNCTION fn_registrar_evento_gamificacion(
  p_user_id UUID,
  p_tipo_evento gamification_event_type,
  p_xp_delta INTEGER DEFAULT 0,
  p_jc_delta INTEGER DEFAULT 0,
  p_referencia_tipo TEXT DEFAULT NULL,
  p_referencia_id TEXT DEFAULT NULL,
  p_reversible BOOLEAN DEFAULT true,
  p_expiracion_dias INTEGER DEFAULT 180,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_xp_antes INTEGER;
  v_xp_despues INTEGER;
  v_jc_antes INTEGER;
  v_jc_despues INTEGER;
  v_nuevo_nivel INTEGER;
  v_nuevo_rango TEXT;
  v_fecha_expiracion TIMESTAMPTZ;
BEGIN
  -- Verificar que el usuario sea agente
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_user_id AND rol = 'Agente') THEN
    RAISE EXCEPTION 'El usuario no es agente';
  END IF;

  -- Crear perfil si no existe
  INSERT INTO agent_gamification_profile (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Obtener valores actuales
  SELECT xp_total, jiro_coins_balance
  INTO v_xp_antes, v_jc_antes
  FROM agent_gamification_profile
  WHERE user_id = p_user_id;

  -- Calcular nuevos valores
  v_xp_despues := v_xp_antes + p_xp_delta;
  v_jc_despues := v_jc_antes + p_jc_delta;

  -- Calcular fecha de expiración para JC
  IF p_jc_delta > 0 AND p_expiracion_dias > 0 THEN
    v_fecha_expiracion := now() + (p_expiracion_dias || ' days')::INTERVAL;
  END IF;

  -- Registrar evento
  INSERT INTO agent_gamification_events (
    user_id,
    tipo_evento,
    referencia_tipo,
    referencia_id,
    xp_delta,
    jc_delta,
    xp_antes,
    xp_despues,
    jc_antes,
    jc_despues,
    fecha_evento,
    fecha_expiracion_jc,
    reversible,
    metadata
  ) VALUES (
    p_user_id,
    p_tipo_evento,
    p_referencia_tipo,
    p_referencia_id,
    p_xp_delta,
    p_jc_delta,
    v_xp_antes,
    v_xp_despues,
    v_jc_antes,
    v_jc_despues,
    now(),
    v_fecha_expiracion,
    p_reversible,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  -- Calcular nuevo nivel
  SELECT nivel, rango INTO v_nuevo_nivel, v_nuevo_rango
  FROM fn_calcular_nivel(v_xp_despues);

  -- Actualizar perfil
  UPDATE agent_gamification_profile
  SET
    xp_total = v_xp_despues,
    jiro_coins_balance = v_jc_despues,
    nivel_actual = v_nuevo_nivel,
    rango_actual = v_nuevo_rango,
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Revertir evento
-- =====================================================

CREATE OR REPLACE FUNCTION fn_revertir_evento_gamificacion(
  p_event_id UUID,
  p_motivo TEXT DEFAULT 'Cancelación'
)
RETURNS UUID AS $$
DECLARE
  v_evento agent_gamification_events%ROWTYPE;
  v_reversal_id UUID;
BEGIN
  -- Obtener evento original
  SELECT * INTO v_evento
  FROM agent_gamification_events
  WHERE id = p_event_id AND reversible = true AND reversed_by_event_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no reversible';
  END IF;

  -- Crear evento de reversa
  v_reversal_id := fn_registrar_evento_gamificacion(
    v_evento.user_id,
    'cancelacion',
    -v_evento.xp_delta,
    -v_evento.jc_delta,
    v_evento.referencia_tipo,
    v_evento.referencia_id,
    false,
    0,
    jsonb_build_object(
      'motivo', p_motivo,
      'evento_original', p_event_id
    )
  );

  -- Marcar evento original como revertido
  UPDATE agent_gamification_events
  SET
    reversed_by_event_id = v_reversal_id,
    metadata = metadata || jsonb_build_object('revertido', true, 'motivo', p_motivo)
  WHERE id = p_event_id;

  RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Procesar expiración de Jiro Coins
-- =====================================================

CREATE OR REPLACE FUNCTION fn_procesar_expiracion_jc()
RETURNS INTEGER AS $$
DECLARE
  v_evento RECORD;
  v_total_expirados INTEGER := 0;
BEGIN
  -- Encontrar eventos con JC que expiran hoy
  FOR v_evento IN
    SELECT
      user_id,
      jc_delta,
      id,
      referencia_tipo,
      referencia_id
    FROM agent_gamification_events
    WHERE fecha_expiracion_jc IS NOT NULL
      AND fecha_expiracion_jc <= now()
      AND jc_delta > 0
      AND reversed_by_event_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM agent_gamification_events e2
        WHERE e2.tipo_evento = 'expiracion_jc'
          AND e2.metadata->>'evento_original' = v_evento.id::TEXT
      )
  LOOP
    -- Registrar evento de expiración
    PERFORM fn_registrar_evento_gamificacion(
      v_evento.user_id,
      'expiracion_jc',
      0,
      -v_evento.jc_delta,
      'evento_expirado',
      v_evento.id::TEXT,
      false,
      0,
      jsonb_build_object(
        'evento_original', v_evento.id,
        'motivo', 'Expiración después de 6 meses'
      )
    );

    v_total_expirados := v_total_expirados + 1;
  END LOOP;

  RETURN v_total_expirados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Actualizar progreso de misión
-- =====================================================

CREATE OR REPLACE FUNCTION fn_actualizar_progreso_mision(
  p_user_id UUID,
  p_mission_id UUID,
  p_incremento INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  v_mision agent_missions%ROWTYPE;
  v_periodo TEXT;
  v_meta INTEGER;
  v_nuevo_progreso INTEGER;
BEGIN
  -- Obtener misión
  SELECT * INTO v_mision
  FROM agent_missions
  WHERE id = p_mission_id AND activa = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Determinar periodo
  CASE v_mision.tipo_periodo
    WHEN 'semanal' THEN
      v_periodo := TO_CHAR(now(), 'IYYY-IW');
    WHEN 'mensual' THEN
      v_periodo := TO_CHAR(now(), 'YYYY-MM');
    WHEN 'unica' THEN
      v_periodo := 'unico';
    ELSE
      v_periodo := 'permanente';
  END CASE;

  -- Obtener meta requerida de la regla
  v_meta := COALESCE((v_mision.regla_json->>'cantidad')::INTEGER, 1);

  -- Actualizar o crear progreso
  INSERT INTO agent_mission_progress (
    user_id,
    mission_id,
    periodo,
    progreso_actual,
    meta_requerida,
    completada
  )
  VALUES (
    p_user_id,
    p_mission_id,
    v_periodo,
    p_incremento,
    v_meta,
    p_incremento >= v_meta
  )
  ON CONFLICT (user_id, mission_id, periodo) DO UPDATE
  SET
    progreso_actual = agent_mission_progress.progreso_actual + p_incremento,
    completada = (agent_mission_progress.progreso_actual + p_incremento) >= agent_mission_progress.meta_requerida,
    updated_at = now();

  -- Si se completó, otorgar recompensa
  SELECT progreso_actual INTO v_nuevo_progreso
  FROM agent_mission_progress
  WHERE user_id = p_user_id AND mission_id = p_mission_id AND periodo = v_periodo;

  IF v_nuevo_progreso >= v_meta THEN
    PERFORM fn_registrar_evento_gamificacion(
      p_user_id,
      'mision_completada',
      v_mision.xp_reward,
      v_mision.jc_reward,
      'agent_missions',
      p_mission_id::TEXT,
      false,
      180,
      jsonb_build_object(
        'mision_nombre', v_mision.nombre,
        'periodo', v_periodo
      )
    );

    UPDATE agent_mission_progress
    SET
      fecha_completada = now(),
      recompensa_reclamada = true
    WHERE user_id = p_user_id AND mission_id = p_mission_id AND periodo = v_periodo;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Verificar misiones automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION fn_verificar_misiones_usuario(
  p_user_id UUID,
  p_tipo_evento gamification_event_type
)
RETURNS VOID AS $$
DECLARE
  v_mision RECORD;
BEGIN
  -- Buscar misiones activas que correspondan al tipo de evento
  FOR v_mision IN
    SELECT id, regla_json
    FROM agent_missions
    WHERE activa = true
      AND (
        (p_tipo_evento = 'poliza_emitida' AND regla_json->>'tipo' = 'polizas_emitidas')
        OR (p_tipo_evento = 'curso_completado' AND regla_json->>'tipo' = 'cursos_completados')
        OR (p_tipo_evento = 'renovacion' AND regla_json->>'tipo' = 'renovaciones')
        OR (p_tipo_evento = 'prospecto' AND regla_json->>'tipo' = 'prospectos')
      )
  LOOP
    PERFORM fn_actualizar_progreso_mision(p_user_id, v_mision.id, 1);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Crear perfil automáticamente
-- =====================================================

CREATE OR REPLACE FUNCTION trg_crear_perfil_gamificacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol = 'Agente' THEN
    INSERT INTO agent_gamification_profile (
      user_id,
      fecha_ingreso_empresa,
      anios_antiguedad,
      multiplicador_veterano
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.fecha_ingreso, CURRENT_DATE),
      0,
      1.0
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_crear_perfil_gamificacion ON usuarios;
CREATE TRIGGER trigger_crear_perfil_gamificacion
  AFTER INSERT OR UPDATE OF rol ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION trg_crear_perfil_gamificacion();

-- =====================================================
-- TRIGGER: Actualizar antigüedad anualmente
-- =====================================================

CREATE OR REPLACE FUNCTION trg_actualizar_antiguedad()
RETURNS void AS $$
BEGIN
  UPDATE agent_gamification_profile
  SET
    anios_antiguedad = EXTRACT(YEAR FROM AGE(CURRENT_DATE, fecha_ingreso_empresa)) +
                       EXTRACT(MONTH FROM AGE(CURRENT_DATE, fecha_ingreso_empresa)) / 12.0,
    multiplicador_veterano = fn_calcular_multiplicador_veterano(
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, fecha_ingreso_empresa)) +
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, fecha_ingreso_empresa)) / 12.0
    ),
    ultima_actualizacion_antiguedad = CURRENT_DATE,
    updated_at = now()
  WHERE fecha_ingreso_empresa IS NOT NULL
    AND (ultima_actualizacion_antiguedad IS NULL 
         OR ultima_actualizacion_antiguedad < CURRENT_DATE - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Verificar misiones al registrar eventos
-- =====================================================

CREATE OR REPLACE FUNCTION trg_verificar_misiones_evento()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo verificar para eventos relevantes
  IF NEW.tipo_evento IN ('poliza_emitida', 'curso_completado', 'renovacion', 'prospecto') THEN
    PERFORM fn_verificar_misiones_usuario(NEW.user_id, NEW.tipo_evento);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_verificar_misiones_evento ON agent_gamification_events;
CREATE TRIGGER trigger_verificar_misiones_evento
  AFTER INSERT ON agent_gamification_events
  FOR EACH ROW
  EXECUTE FUNCTION trg_verificar_misiones_evento();

-- =====================================================
-- TRIGGER: Actualizar contadores en perfil
-- =====================================================

CREATE OR REPLACE FUNCTION trg_actualizar_contadores_perfil()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_gamification_profile
  SET
    total_polizas_emitidas = total_polizas_emitidas + CASE WHEN NEW.tipo_evento = 'poliza_emitida' THEN 1 ELSE 0 END,
    total_prospectos = total_prospectos + CASE WHEN NEW.tipo_evento = 'prospecto' THEN 1 ELSE 0 END,
    total_cursos_completados = total_cursos_completados + CASE WHEN NEW.tipo_evento = 'curso_completado' THEN 1 ELSE 0 END,
    total_certificaciones = total_certificaciones + CASE WHEN NEW.tipo_evento = 'certificacion' THEN 1 ELSE 0 END,
    total_renovaciones = total_renovaciones + CASE WHEN NEW.tipo_evento = 'renovacion' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_actualizar_contadores_perfil ON agent_gamification_events;
CREATE TRIGGER trigger_actualizar_contadores_perfil
  AFTER INSERT ON agent_gamification_events
  FOR EACH ROW
  WHEN (NEW.tipo_evento IN ('poliza_emitida', 'prospecto', 'curso_completado', 'certificacion', 'renovacion'))
  EXECUTE FUNCTION trg_actualizar_contadores_perfil();