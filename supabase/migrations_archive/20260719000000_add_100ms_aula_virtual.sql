-- 100ms integration metadata for the existing Aula Virtual module.
ALTER TABLE aula_virtual_sesiones
  ADD COLUMN IF NOT EXISTS hms_template_id text,
  ADD COLUMN IF NOT EXISTS hms_room_id text,
  ADD COLUMN IF NOT EXISTS tipo_sesion text NOT NULL DEFAULT 'interactiva'
    CHECK (tipo_sesion IN ('interactiva', 'webinar')),
  ADD COLUMN IF NOT EXISTS permitir_camara_estudiantes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permitir_mic_estudiantes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grabacion_hms_id text;

CREATE INDEX IF NOT EXISTS idx_aula_virtual_sesiones_hms_room
  ON aula_virtual_sesiones(hms_room_id);
