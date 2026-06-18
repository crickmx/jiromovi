/*
  # Create upsert_chava_topic_trend RPC function

  Missing stored procedure required by chava-agente-chat edge function.
  Performs an UPSERT into chava_topic_trends with increment logic on the
  UNIQUE constraint (fecha, periodo, intent_codigo, plataforma).

  Parameters:
  - p_fecha: date of the trend period
  - p_periodo: 'diario' | 'semanal' | 'mensual'
  - p_intent_codigo: intent code from chava_intent_catalog
  - p_plataforma: platform identifier (e.g. 'chava', 'seguwallet')
  - p_incremento: number to add to total_consultas (usually 1)
*/

CREATE OR REPLACE FUNCTION upsert_chava_topic_trend(
  p_fecha date,
  p_periodo text,
  p_intent_codigo text,
  p_plataforma text,
  p_incremento int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chava_topic_trends (
    fecha,
    periodo,
    intent_codigo,
    plataforma,
    total_consultas,
    updated_at
  )
  VALUES (
    p_fecha,
    p_periodo,
    p_intent_codigo,
    p_plataforma,
    p_incremento,
    now()
  )
  ON CONFLICT (fecha, periodo, intent_codigo, plataforma)
  DO UPDATE SET
    total_consultas = chava_topic_trends.total_consultas + p_incremento,
    updated_at = now();
END;
$$;

-- Grant execute to service_role and authenticated
GRANT EXECUTE ON FUNCTION upsert_chava_topic_trend(date, text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_chava_topic_trend(date, text, text, text, int) TO authenticated;
