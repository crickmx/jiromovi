/*
  # Fix: Políticas de UPDATE para Administradores y Gerentes

  1. Problema
    - Solo existe política para usuarios actualizando su propio perfil
    - Administradores y Gerentes no pueden actualizar otros usuarios
    - Las actualizaciones fallan silenciosamente sin mostrar error
  
  2. Solución
    - Agregar política para que Administradores puedan actualizar cualquier usuario
    - Agregar política para que Gerentes puedan actualizar usuarios de su oficina
  
  3. Seguridad
    - Administradores: acceso completo
    - Gerentes: solo usuarios de su oficina
    - Usuarios regulares: solo su propio perfil
*/

-- Política para Administradores: pueden actualizar cualquier usuario
CREATE POLICY "Admins: update all users"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.estado = 'activo'
      AND (u.is_deleted = false OR u.is_deleted IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.estado = 'activo'
      AND (u.is_deleted = false OR u.is_deleted IS NULL)
    )
  );

-- Política para Gerentes: pueden actualizar usuarios de su oficina
CREATE POLICY "Gerentes: update office users"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.estado = 'activo'
      AND (gerente.is_deleted = false OR gerente.is_deleted IS NULL)
      AND gerente.oficina_id = usuarios.oficina_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.estado = 'activo'
      AND (gerente.is_deleted = false OR gerente.is_deleted IS NULL)
      AND gerente.oficina_id = usuarios.oficina_id
    )
  );