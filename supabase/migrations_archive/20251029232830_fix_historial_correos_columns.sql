/*
  # Corregir columnas faltantes en historial_correos

  ## Descripción
  Agrega columnas faltantes a la tabla historial_correos que se usan en el frontend.

  ## Cambios
  - Agrega cuerpo_html (alias/renombrar de cuerpo)
  - Agrega fecha_envio 
  - Agrega tipo_envio
  - Agrega otras columnas necesarias

  ## Seguridad
  - No hay cambios en RLS
*/

-- Agregar columnas faltantes
ALTER TABLE historial_correos 
ADD COLUMN IF NOT EXISTS cuerpo_html text,
ADD COLUMN IF NOT EXISTS fecha_envio timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS tipo_envio text DEFAULT 'manual';

-- Copiar datos de cuerpo a cuerpo_html si está vacío
UPDATE historial_correos 
SET cuerpo_html = cuerpo 
WHERE cuerpo_html IS NULL AND cuerpo IS NOT NULL;

-- Inicializar fecha_envio con created_at si está vacía
UPDATE historial_correos 
SET fecha_envio = created_at 
WHERE fecha_envio IS NULL;
