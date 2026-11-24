/*
  # Agregar columna descripcion a ticket_historial

  ## Descripción
  Agrega la columna descripcion para almacenar descripciones textuales simples
  de los cambios en el historial del ticket. Complementa el campo detalle (jsonb).

  ## Cambios
  - Agrega columna `descripcion` (text)
  - Permite almacenar descripciones simples de cambios

  ## Seguridad
  - Se mantienen las políticas RLS existentes
*/

-- Agregar columna descripcion
ALTER TABLE ticket_historial 
ADD COLUMN IF NOT EXISTS descripcion text;

COMMENT ON COLUMN ticket_historial.descripcion IS 'Descripción textual del cambio realizado';
