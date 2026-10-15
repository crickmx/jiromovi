/*
  # Sistema de Estatus para Cotización/Emisión - Agregar campo resultado

  1. Cambios en Base de Datos
    - Agregar campo `resultado` a tickets: clasificación de ganado/perdido/en_progreso
    - Crear estatus específicos para Cotización/Emisión
    - Agregar función para calcular resultado automáticamente

  2. Estatus Específicos
    - Iniciado (gris) → en_progreso
    - En Proceso (naranja) → en_progreso
    - Emitido (verde) → ganado
    - No Emitido (rojo) → perdido
*/

-- =====================================================
-- 1. AGREGAR CAMPO RESULTADO A TICKETS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'resultado'
  ) THEN
    ALTER TABLE tickets ADD COLUMN resultado TEXT;
    
    ALTER TABLE tickets ADD CONSTRAINT tickets_resultado_check
      CHECK (resultado IN ('ganado', 'perdido', 'en_progreso') OR resultado IS NULL);
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_tickets_resultado
  ON tickets(resultado)
  WHERE resultado IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_tipo_resultado
  ON tickets(tipo_tramite, resultado)
  WHERE tipo_tramite = 'registro_actividad' AND resultado IS NOT NULL;

-- =====================================================
-- 2. CREAR ESTATUS ESPECÍFICOS PARA COTIZACIÓN/EMISIÓN
-- =====================================================
INSERT INTO ticket_estatus (nombre, color, orden, activo)
VALUES 
  ('Iniciado', '#6b7280', 10, true),
  ('Emitido', '#10b981', 11, true),
  ('No Emitido', '#ef4444', 12, true)
ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- 3. COMENTARIOS
-- =====================================================
COMMENT ON COLUMN tickets.resultado IS 'Clasificación del resultado para trámites de Cotización/Emisión: ganado (Emitido), perdido (No Emitido), en_progreso (Iniciado/En Proceso)';
