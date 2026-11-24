/*
  # Funciones y Triggers para Gamificación

  1. Functions
    - `calculate_agent_level()` - Calcula nivel basado en XP
    - `calculate_veteran_multiplier()` - Calcula multiplicador por antigüedad
    - `add_gamification_event()` - Registra evento y actualiza perfil
    - `reverse_gamification_event()` - Revierte evento (cancelaciones)
    - `expire_jiro_coins()` - Expira JC vencidos
    - `check_mission_progress()` - Verifica progreso de misiones
    - `initialize_agent_profile()` - Crea perfil al crear agente

  2. Triggers
    - Auto-crear perfil cuando se crea usuario con rol Agente
    - Auto-actualizar nivel cuando cambia XP
    - Auto-calcular antigüedad

  3. Business Logic
    - XP determina nivel automáticamente
    - Antigüedad otorga multiplicador
    - Eventos son auditables
    - JC pueden expirar
*/

-- =====================================================
-- FUNCIÓN: Calcular nivel basado en XP
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_agent_level(p_xp_total INTEGER)
RETURNS TABLE(nivel INTEGER, rango TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT al.nivel, al.rango
  FROM agent_levels al
  WHERE p_xp_total >= al.xp_min
    AND (al.xp_max IS NULL OR p_xp_total <= al.xp_max)
  ORDER BY al.nivel DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- FUNCIÓN: Calcular multiplicador veterano
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_veteran_multiplier(p_anios NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  -- 2% por año de antigüedad: 1.00 + (años × 0.02)
  RETURN GREATEST(1.00, 1.00 + (p_anios * 0.02));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FUNCIÓN: Actualizar antigüedad
-- =====================================================

CREATE OR REPLACE FUNCTION update_agent_seniority()
RETURNS void AS $$
BEGIN
  UPDATE agent_gamification_profile
  SET 
    anios_antiguedad = EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_ingreso_empresa)) +
                       (EXTRACT(MONTH FROM age(CURRENT_DATE, fecha_ingreso_empresa)) / 12.0),
    multiplicador_veterano = calculate_veteran_multiplier(
      EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_ingreso_empresa)) +
      (EXTRACT(MONTH FROM age(CURRENT_DATE, fecha_ingreso_empresa)) / 12.0)
    ),
    ultima_actualizacion_antiguedad = CURRENT_DATE,
    updated_at = now()
  WHERE fecha_ingreso_empresa IS NOT NULL
    AND (ultima_actualizacion_antiguedad IS NULL 
         OR ultima_actualizacion_antiguedad < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Registrar evento de gamificación
-- =====================================================

CREATE OR REPLACE FUNCTION add_gamification_event(
  p_user_id UUID,
  p_tipo_evento gamification_event_type,
  p_referencia_tipo TEXT DEFAULT NULL,
  p_referencia_id TEXT DEFAULT NULL,
  p_xp_delta INTEGER DEFAULT 0,
  p_jc_delta INTEGER DEFAULT 0,
  p_reversible BOOLEAN DEFAULT true,
  p_jc_expiration_months INTEGER DEFAULT 6,
  p_metadata JSONB DEFAULT '{}',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_profile agent_gamification_profile;
  v_new_xp INTEGER;
  v_new_jc INTEGER;
  v_new_nivel INTEGER;
  v_new_rango TEXT;
  v_expiration_date TIMESTAMPTZ;
  v_multiplier NUMERIC;
BEGIN
  -- Obtener perfil actual
  SELECT * INTO v_profile
  FROM agent_gamification_profile
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de gamificación no encontrado para usuario %', p_user_id;
  END IF;

  -- Aplicar multiplicador veterano al XP
  v_multiplier := v_profile.multiplicador_veterano;
  p_xp_delta := FLOOR(p_xp_delta * v_multiplier);

  -- Calcular nuevos totales
  v_new_xp := v_profile.xp_total + p_xp_delta;
  v_new_jc := v_profile.jiro_coins_balance + p_jc_delta;

  -- No permitir XP negativo
  v_new_xp := GREATEST(0, v_new_xp);

  -- Calcular nuevo nivel
  SELECT nivel, rango INTO v_new_nivel, v_new_rango
  FROM calculate_agent_level(v_new_xp);

  -- Calcular fecha de expiración JC (si aplica)
  IF p_jc_delta > 0 AND p_jc_expiration_months > 0 THEN
    v_expiration_date := now() + (p_jc_expiration_months || ' months')::INTERVAL;
  END IF;

  -- Insertar evento
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
    metadata,
    created_by
  ) VALUES (
    p_user_id,
    p_tipo_evento,
    p_referencia_tipo,
    p_referencia_id,
    p_xp_delta,
    p_jc_delta,
    v_profile.xp_total,
    v_new_xp,
    v_profile.jiro_coins_balance,
    v_new_jc,
    now(),
    v_expiration_date,
    p_reversible,
    p_metadata,
    p_created_by
  )
  RETURNING id INTO v_event_id;

  -- Actualizar perfil
  UPDATE agent_gamification_profile
  SET
    xp_total = v_new_xp,
    jiro_coins_balance = v_new_jc,
    nivel_actual = v_new_nivel,
    rango_actual = v_new_rango,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Actualizar contadores según tipo de evento
  IF p_tipo_evento = 'poliza_emitida' THEN
    UPDATE agent_gamification_profile
    SET total_polizas_emitidas = total_polizas_emitidas + 1
    WHERE user_id = p_user_id;
  ELSIF p_tipo_evento = 'prospecto' THEN
    UPDATE agent_gamification_profile
    SET total_prospectos = total_prospectos + 1
    WHERE user_id = p_user_id;
  ELSIF p_tipo_evento = 'curso_completado' THEN
    UPDATE agent_gamification_profile
    SET total_cursos_completados = total_cursos_completados + 1
    WHERE user_id = p_user_id;
  ELSIF p_tipo_evento = 'certificacion' THEN
    UPDATE agent_gamification_profile
    SET total_certificaciones = total_certificaciones + 1
    WHERE user_id = p_user_id;
  ELSIF p_tipo_evento = 'renovacion' THEN
    UPDATE agent_gamification_profile
    SET total_renovaciones = total_renovaciones + 1
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Revertir evento (cancelaciones)
-- =====================================================

CREATE OR REPLACE FUNCTION reverse_gamification_event(
  p_event_id UUID,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_original_event agent_gamification_events;
  v_reversal_id UUID;
BEGIN
  -- Obtener evento original
  SELECT * INTO v_original_event
  FROM agent_gamification_events
  WHERE id = p_event_id
    AND reversible = true
    AND reversed_by_event_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento no encontrado o no reversible';
  END IF;

  -- Crear evento de reversa (deltas negativos)
  v_reversal_id := add_gamification_event(
    p_user_id := v_original_event.user_id,
    p_tipo_evento := 'cancelacion',
    p_referencia_tipo := v_original_event.referencia_tipo,
    p_referencia_id := v_original_event.referencia_id,
    p_xp_delta := -v_original_event.xp_delta,
    p_jc_delta := -v_original_event.jc_delta,
    p_reversible := false,
    p_jc_expiration_months := 0,
    p_metadata := jsonb_build_object(
      'original_event_id', p_event_id,
      'motivo', 'cancelacion'
    ),
    p_created_by := p_created_by
  );

  -- Marcar evento original como revertido
  UPDATE agent_gamification_events
  SET 
    reversed_by_event_id = v_reversal_id,
    is_reversal = true
  WHERE id = p_event_id;

  RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Expirar Jiro Coins vencidos
-- =====================================================

CREATE OR REPLACE FUNCTION expire_jiro_coins()
RETURNS INTEGER AS $$
DECLARE
  v_expired_event agent_gamification_events;
  v_expired_count INTEGER := 0;
BEGIN
  FOR v_expired_event IN
    SELECT *
    FROM agent_gamification_events
    WHERE fecha_expiracion_jc IS NOT NULL
      AND fecha_expiracion_jc <= now()
      AND reversed_by_event_id IS NULL
      AND jc_delta > 0
  LOOP
    -- Crear evento de expiración
    PERFORM add_gamification_event(
      p_user_id := v_expired_event.user_id,
      p_tipo_evento := 'expiracion_jc',
      p_referencia_tipo := 'evento',
      p_referencia_id := v_expired_event.id::TEXT,
      p_xp_delta := 0,
      p_jc_delta := -v_expired_event.jc_delta,
      p_reversible := false,
      p_jc_expiration_months := 0,
      p_metadata := jsonb_build_object(
        'original_event_id', v_expired_event.id,
        'motivo', 'expiracion'
      )
    );

    -- Marcar como expirado
    UPDATE agent_gamification_events
    SET reversed_by_event_id = v_expired_event.id
    WHERE id = v_expired_event.id;

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Inicializar perfil de agente
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_agent_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear perfil si el rol es Agente
  IF NEW.rol = 'Agente' THEN
    INSERT INTO agent_gamification_profile (
      user_id,
      fecha_ingreso_empresa,
      anios_antiguedad,
      multiplicador_veterano
    ) VALUES (
      NEW.id,
      COALESCE(NEW.fecha_ingreso, CURRENT_DATE),
      0,
      1.00
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: Verificar progreso de misiones
-- =====================================================

CREATE OR REPLACE FUNCTION check_mission_progress(
  p_user_id UUID,
  p_mission_id UUID,
  p_incremento INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_mission agent_missions;
  v_progress agent_mission_progress;
  v_periodo TEXT;
  v_completada BOOLEAN := false;
BEGIN
  -- Obtener misión
  SELECT * INTO v_mission
  FROM agent_missions
  WHERE id = p_mission_id AND activa = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Calcular periodo
  IF v_mission.tipo_periodo = 'semanal' THEN
    v_periodo := to_char(CURRENT_DATE, 'IYYY-IW');
  ELSIF v_mission.tipo_periodo = 'mensual' THEN
    v_periodo := to_char(CURRENT_DATE, 'YYYY-MM');
  ELSIF v_mission.tipo_periodo = 'unica' THEN
    v_periodo := 'unica';
  ELSE
    v_periodo := 'permanente';
  END IF;

  -- Obtener o crear progreso
  INSERT INTO agent_mission_progress (
    user_id,
    mission_id,
    periodo,
    progreso_actual,
    meta_requerida
  ) VALUES (
    p_user_id,
    p_mission_id,
    v_periodo,
    0,
    (v_mission.regla_json->>'cantidad')::INTEGER
  )
  ON CONFLICT (user_id, mission_id, periodo)
  DO NOTHING;

  -- Actualizar progreso
  UPDATE agent_mission_progress
  SET 
    progreso_actual = progreso_actual + p_incremento,
    updated_at = now()
  WHERE user_id = p_user_id
    AND mission_id = p_mission_id
    AND periodo = v_periodo
    AND NOT completada
  RETURNING * INTO v_progress;

  -- Verificar si se completó
  IF v_progress.progreso_actual >= v_progress.meta_requerida AND NOT v_progress.completada THEN
    UPDATE agent_mission_progress
    SET 
      completada = true,
      fecha_completada = now()
    WHERE id = v_progress.id;

    -- Otorgar recompensa
    PERFORM add_gamification_event(
      p_user_id := p_user_id,
      p_tipo_evento := 'mision_completada',
      p_referencia_tipo := 'mision',
      p_referencia_id := p_mission_id::TEXT,
      p_xp_delta := v_mission.xp_reward,
      p_jc_delta := v_mission.jc_reward,
      p_metadata := jsonb_build_object(
        'mision_nombre', v_mission.nombre,
        'periodo', v_periodo
      )
    );

    v_completada := true;
  END IF;

  RETURN v_completada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Auto-inicializar perfil
-- =====================================================

CREATE TRIGGER trigger_initialize_agent_profile
  AFTER INSERT ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION initialize_agent_profile();

-- =====================================================
-- TRIGGER: Auto-actualizar updated_at
-- =====================================================

CREATE TRIGGER trigger_update_gamification_profile_timestamp
  BEFORE UPDATE ON agent_gamification_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_missions_timestamp
  BEFORE UPDATE ON agent_missions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_mission_progress_timestamp
  BEFORE UPDATE ON agent_mission_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
