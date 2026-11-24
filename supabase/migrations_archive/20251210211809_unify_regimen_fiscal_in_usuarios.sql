/*
  # Unificar Régimen Fiscal en Usuarios

  1. Cambios en tabla usuarios
    - Agregar columna `regimen_fiscal_id` (uuid, FK a commission_fiscal_regimes)
    - Migrar datos de `esquema_pago_id` a `regimen_fiscal_id` (mapeo por nombre)
    - Eliminar columna `esquema_pago_id`

  2. Mapeo de datos
    - "Honorarios" en esquemas_pago → "Honorarios" en commission_fiscal_regimes
    - "Comisiones" en esquemas_pago → "RESICO" en commission_fiscal_regimes (por defecto para comisionistas)
    - "Nómina Mensual", "Mensual", "Quincenal", "Semanal" → "Asimilados" en commission_fiscal_regimes
    - Otros → "RESICO" por defecto

  3. Notas importantes
    - La tabla esquemas_pago se mantiene por compatibilidad pero usuarios ya no la usará
    - Todos los usuarios deben tener un régimen fiscal válido
    - Los regímenes fiscales son: RESICO, Honorarios, Asimilados
*/

-- Agregar columna regimen_fiscal_id a usuarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'regimen_fiscal_id'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN regimen_fiscal_id uuid REFERENCES commission_fiscal_regimes(id);
  END IF;
END $$;

-- Migrar datos de esquema_pago_id a regimen_fiscal_id
DO $$
DECLARE
  resico_id uuid;
  honorarios_id uuid;
  asimilados_id uuid;
BEGIN
  -- Obtener IDs de los regímenes fiscales
  SELECT id INTO resico_id FROM commission_fiscal_regimes WHERE name = 'RESICO' LIMIT 1;
  SELECT id INTO honorarios_id FROM commission_fiscal_regimes WHERE name = 'Honorarios' LIMIT 1;
  SELECT id INTO asimilados_id FROM commission_fiscal_regimes WHERE name = 'Asimilados' LIMIT 1;

  -- Migrar usuarios con esquema "Honorarios" → Honorarios
  UPDATE usuarios u
  SET regimen_fiscal_id = honorarios_id
  FROM esquemas_pago e
  WHERE u.esquema_pago_id = e.id
    AND e.nombre = 'Honorarios'
    AND u.regimen_fiscal_id IS NULL;

  -- Migrar usuarios con esquema "Comisiones" → RESICO
  UPDATE usuarios u
  SET regimen_fiscal_id = resico_id
  FROM esquemas_pago e
  WHERE u.esquema_pago_id = e.id
    AND e.nombre = 'Comisiones'
    AND u.regimen_fiscal_id IS NULL;

  -- Migrar usuarios con esquemas de nómina → Asimilados
  UPDATE usuarios u
  SET regimen_fiscal_id = asimilados_id
  FROM esquemas_pago e
  WHERE u.esquema_pago_id = e.id
    AND e.nombre IN ('Nómina Mensual', 'Mensual', 'Quincenal', 'Semanal', 'Mixto')
    AND u.regimen_fiscal_id IS NULL;

  -- Para cualquier usuario restante sin regimen_fiscal_id, asignar RESICO por defecto
  UPDATE usuarios
  SET regimen_fiscal_id = resico_id
  WHERE regimen_fiscal_id IS NULL AND esquema_pago_id IS NOT NULL;

  -- Para usuarios que no tenían esquema_pago_id, asignar RESICO por defecto
  UPDATE usuarios
  SET regimen_fiscal_id = resico_id
  WHERE regimen_fiscal_id IS NULL;
END $$;

-- Eliminar la columna esquema_pago_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'esquema_pago_id'
  ) THEN
    ALTER TABLE usuarios DROP COLUMN esquema_pago_id;
  END IF;
END $$;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_regimen_fiscal_id ON usuarios(regimen_fiscal_id);

-- Sincronizar commission_agents con usuarios (actualizar regimen_fiscal_id de agentes basado en email)
DO $$
BEGIN
  UPDATE commission_agents ca
  SET fiscal_regime_id = u.regimen_fiscal_id
  FROM usuarios u
  WHERE ca.email = u.email_personal 
    OR ca.email = u.email_laboral
    AND u.regimen_fiscal_id IS NOT NULL;
END $$;
