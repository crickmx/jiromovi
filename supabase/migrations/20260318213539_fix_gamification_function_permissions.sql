/*
  # Fix Gamification Function Permissions

  1. Grant Execute Permissions
    - Ensure all gamification functions can be executed by authenticated users
*/

-- Grant execute on core functions
GRANT EXECUTE ON FUNCTION fn_calcular_nivel(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_calcular_multiplicador_veterano(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_registrar_evento_gamificacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_revertir_evento_gamificacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_procesar_expiracion_jc TO authenticated;
GRANT EXECUTE ON FUNCTION fn_actualizar_progreso_mision TO authenticated;
GRANT EXECUTE ON FUNCTION fn_verificar_misiones_usuario TO authenticated;

-- Grant execute on ranking and statistics functions
GRANT EXECUTE ON FUNCTION fn_ranking_global TO authenticated;
GRANT EXECUTE ON FUNCTION fn_ranking_oficina TO authenticated;
GRANT EXECUTE ON FUNCTION fn_ranking_jiro_coins TO authenticated;
GRANT EXECUTE ON FUNCTION fn_historial_eventos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_estadisticas_gamificacion TO authenticated;
GRANT EXECUTE ON FUNCTION fn_misiones_agente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_obtener_posicion_agente TO authenticated;
GRANT EXECUTE ON FUNCTION fn_proximos_niveles TO authenticated;
