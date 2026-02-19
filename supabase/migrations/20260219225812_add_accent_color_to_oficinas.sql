/*
  # Agregar color de acento personalizado por oficina

  1. Cambios
    - Agrega columna `accent_color` a tabla `oficinas`
    - Color en formato HEX (#RRGGBB)
    - Default: #0E23E2 (azul actual de MOVI)
    - Actualiza todas las oficinas existentes con el color por defecto

  2. Detalles
    - Solo administradores pueden modificar el color
    - Se usa para personalizar la UI de toda la plataforma por oficina
    - Permite branding personalizado para cada oficina
*/

-- Agregar columna accent_color a oficinas
ALTER TABLE oficinas
ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#0E23E2';

-- Agregar constraint para validar formato HEX
ALTER TABLE oficinas
ADD CONSTRAINT accent_color_hex_format
CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');

-- Comentario descriptivo
COMMENT ON COLUMN oficinas.accent_color IS 'Color de acento personalizado en formato HEX (#RRGGBB) para personalizar la UI de la oficina';

-- Actualizar oficinas existentes con el color por defecto (azul MOVI)
UPDATE oficinas
SET accent_color = '#0E23E2'
WHERE accent_color IS NULL OR accent_color = '';