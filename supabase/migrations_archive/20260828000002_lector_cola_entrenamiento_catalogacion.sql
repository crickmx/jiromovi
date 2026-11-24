-- Columnas de catalogación manual para lector.movi.digital
-- El equipo de lector captura ramo, sub_ramo y notas desde su plataforma.
-- archivo_path guarda la ruta dentro del bucket ticket-archivos para generar
-- signed URLs (el bucket es privado, getPublicUrl no basta).

ALTER TABLE public.lector_cola_entrenamiento
  ADD COLUMN IF NOT EXISTS ramo         text,
  ADD COLUMN IF NOT EXISTS sub_ramo     text,
  ADD COLUMN IF NOT EXISTS notas        text,
  ADD COLUMN IF NOT EXISTS archivo_path text;
