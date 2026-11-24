/*
  # seguros.express — Ubicación del agente + habilitación (Parte A)

  Columnas nuevas en `usuarios` (todas aditivas: nullable o con default, no
  rompen ningún insert existente):

  Ubicación (editable por el propio usuario y por un administrador; la RLS
  actual de `usuarios` ya permite ambos: self-update por `id = auth.uid()` y
  update por Administrador — no se toca RLS):
    - ubicacion_lat            numeric
    - ubicacion_lng            numeric
    - ubicacion_direccion_manual text
    - ubicacion_metodo         text  CHECK ('gps' | 'manual')  (nullable)
    - ubicacion_updated_at     timestamptz

  Habilitación de la función seguros.express (SOLO editable por administrador
  desde el frontend; en el perfil propio se muestra en modo lectura):
    - seguros_express_habilitado boolean NOT NULL DEFAULT false

  Nota: la columna `usuarios.estado` NO es un estado geográfico (es status de
  ciclo de vida 'registrado'/'activo'); la ubicación vive exclusivamente en
  estas columnas nuevas.
*/

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ubicacion_lat numeric,
  ADD COLUMN IF NOT EXISTS ubicacion_lng numeric,
  ADD COLUMN IF NOT EXISTS ubicacion_direccion_manual text,
  ADD COLUMN IF NOT EXISTS ubicacion_metodo text,
  ADD COLUMN IF NOT EXISTS ubicacion_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS seguros_express_habilitado boolean NOT NULL DEFAULT false;

-- CHECK del método de captura (se agrega por separado para poder usar IF NOT EXISTS
-- de forma idempotente vía catálogo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_ubicacion_metodo_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_ubicacion_metodo_check
      CHECK (ubicacion_metodo IS NULL OR ubicacion_metodo IN ('gps', 'manual'));
  END IF;
END;
$$;

-- Índice para el matching por distancia (solo agentes habilitados con coordenadas).
CREATE INDEX IF NOT EXISTS usuarios_seguros_express_coords_idx
  ON public.usuarios (ubicacion_lat, ubicacion_lng)
  WHERE seguros_express_habilitado = true
    AND ubicacion_lat IS NOT NULL
    AND ubicacion_lng IS NOT NULL;

COMMENT ON COLUMN public.usuarios.seguros_express_habilitado IS
  'seguros.express: si el agente participa en el matching de leads. Solo editable por Administrador.';
