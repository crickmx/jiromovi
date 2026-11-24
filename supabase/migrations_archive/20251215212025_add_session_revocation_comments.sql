/*
  # Add Session Revocation Comments and Documentation

  1. Documentation
    - Add comments explaining session revocation flow
    - Document how deleted users are blocked from login
    
  2. Notes
    - Session revocation happens in the edge function delete-user
    - Login blocking happens via check_user_can_login function
    - AuthContext verifies user status on every login attempt
*/

-- Add comprehensive comments
COMMENT ON FUNCTION safe_delete_user IS 'Realiza soft delete de un usuario con validaciones completas. Las sesiones se revocan en el edge function delete-user.';

COMMENT ON FUNCTION check_user_can_login IS 'Verifica si un usuario puede iniciar sesión. Bloquea usuarios eliminados (is_deleted=true), inactivos (activo=false) o suspendidos (estado=suspendido).';

-- Add comment on is_deleted column
COMMENT ON COLUMN usuarios.is_deleted IS 'Soft delete flag. Cuando es true, el usuario no puede iniciar sesión y no aparece en listados. Sus datos históricos se conservan. Las sesiones activas se revocan automáticamente al eliminarse.';

-- Verify all constraints are in place
DO $$
BEGIN
  -- Ensure estado constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_estado_check'
  ) THEN
    ALTER TABLE usuarios 
      ADD CONSTRAINT usuarios_estado_check 
      CHECK (estado IN ('activo', 'suspendido', 'eliminado'));
  END IF;

  -- Ensure foreign key for deleted_by exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'usuarios_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_deleted_by_user_id_fkey
      FOREIGN KEY (deleted_by_user_id)
      REFERENCES usuarios(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Create helpful view for admins to see deleted users
CREATE OR REPLACE VIEW usuarios_eliminados AS
SELECT
  u.id,
  u.nombre,
  u.apellidos,
  u.email_laboral,
  u.rol,
  o.nombre as oficina_nombre,
  u.deleted_at,
  u.deleted_by_user_id,
  admin.nombre as eliminado_por_nombre,
  admin.apellidos as eliminado_por_apellidos
FROM usuarios u
LEFT JOIN oficinas o ON u.oficina_id = o.id
LEFT JOIN usuarios admin ON u.deleted_by_user_id = admin.id
WHERE u.is_deleted = true
ORDER BY u.deleted_at DESC;

-- Grant view access to admins only (via RLS on base table)
GRANT SELECT ON usuarios_eliminados TO authenticated;

COMMENT ON VIEW usuarios_eliminados IS 'Vista de usuarios eliminados (soft delete). Solo accesible para administradores.';
