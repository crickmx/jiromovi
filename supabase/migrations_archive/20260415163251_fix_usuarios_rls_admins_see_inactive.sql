/*
  # Fix RLS: Administradores deben ver usuarios inactivos

  ## Problema
  La política "Authenticated: read active users" filtra con `estado = 'activo'`,
  lo que hace que los usuarios marcados como inactivos desaparezcan de la lista
  del administrador.

  ## Solución
  Reemplazar la política SELECT de usuarios con dos políticas:
  1. Administradores ven TODOS los usuarios (activos, inactivos, registrados) no eliminados.
  2. El resto de usuarios autenticados solo ven usuarios activos (comportamiento previo).

  Esto mantiene la seguridad sin romper la gestión de usuarios del Admin.
*/

-- Eliminar política existente que bloquea la vista a inactivos
DROP POLICY IF EXISTS "Authenticated: read active users" ON usuarios;

-- Política para Administradores: ver todos los usuarios no eliminados (incluye inactivos)
CREATE POLICY "Admins can read all non-deleted users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Administrador'
        AND u.estado = 'activo'
        AND u.deleted_at IS NULL
    )
    AND ((is_deleted = false) OR (is_deleted IS NULL))
  );

-- Política para el resto de roles autenticados: solo ven usuarios activos
CREATE POLICY "Authenticated users read active users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    (estado = 'activo')
    AND ((is_deleted = false) OR (is_deleted IS NULL))
    AND NOT EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Administrador'
        AND u.estado = 'activo'
        AND u.deleted_at IS NULL
    )
  );
