/*
  # Fix upsert_chava_topic_trend to match actual chava_topic_trends schema

  The previously created function used wrong column name `total_consultas`.
  The actual table uses `conteo`. This migration replaces the function with the correct column name.
  Also, the `fecha` column is type `date`, so weekly/monthly records use the Monday of the week
  and the first of the month respectively (both valid dates).
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
    conteo,
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
    conteo = chava_topic_trends.conteo + p_incremento,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_chava_topic_trend(date, text, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_chava_topic_trend(date, text, text, text, int) TO authenticated;
