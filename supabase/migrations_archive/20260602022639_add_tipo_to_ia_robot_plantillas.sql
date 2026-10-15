/*
  # Add missing tipo column to ia_robot_plantillas

  1. Changes
    - `ia_robot_plantillas`: Add `tipo` (text) column
      - Values: respuesta_automatica, notificacion_interna, comunicado, reenvio
      - Defaults to 'respuesta_automatica'

  2. Notes
    - No data loss — existing rows get the default value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ia_robot_plantillas' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE ia_robot_plantillas ADD COLUMN tipo text NOT NULL DEFAULT 'respuesta_automatica';
  END IF;
END $$;
