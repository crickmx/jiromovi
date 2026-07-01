-- Agrega columna 'origen' a maestro_agentes para distinguir
-- registros que vienen del catálogo SICAS vs usuarios MOVI sin contraparte SICAS.
ALTER TABLE public.maestro_agentes
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'sicas';

-- Actualiza el label en tramite_tipo_campos para campos agente_vendedor
-- que aún tengan el nombre anterior.
UPDATE public.tramite_tipo_campos
SET label = 'Usuario Asignado'
WHERE sistema_key = 'agente_vendedor'
  AND label ILIKE '%agente%';
