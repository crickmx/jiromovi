/*
  # Create Academia de Negocios 2025 Category

  1. Changes
    - Insert new category "Academia de Negocios 2025" for Seguros Education
    - Category will be used for organizing 29 business training lessons
    - Visible to all users across all offices

  2. Security
    - Uses existing RLS policies from seguros_categories table
    - Only administrators can manage categories
    - All authenticated users can view categories
*/

-- Insert Academia de Negocios 2025 category
-- Use first available administrator as creator
INSERT INTO seguros_categories (nombre, descripcion, creado_por)
SELECT
  'Academia de Negocios 2025',
  'Programa de formación empresarial y profesional para agentes de seguros 2025',
  (SELECT id FROM usuarios WHERE rol = 'Administrador' AND activo = true ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM seguros_categories
  WHERE nombre = 'Academia de Negocios 2025'
);
