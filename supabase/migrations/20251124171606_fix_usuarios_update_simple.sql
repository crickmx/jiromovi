/*
  # Simplificar Políticas UPDATE de Usuarios (Sin Recursión)

  ## Problema
  Las políticas anteriores usaban auth.users que puede causar problemas.
  
  ## Solución Simple
  Usar solo auth.uid() para permitir updates, y confiar en la lógica de negocio
  del frontend para determinar quién puede actualizar qué.
  
  Alternativamente, usar el rol almacenado en auth.jwt() que viene de los metadatos
  del usuario autenticado.
*/

-- Eliminar políticas UPDATE existentes
DROP POLICY IF EXISTS "Users can update own profile" ON usuarios;
DROP POLICY IF EXISTS "Admins can update any user" ON usuarios;
DROP POLICY IF EXISTS "Gerentes can update office users" ON usuarios;

-- Política 1: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política 2: Administradores pueden actualizar cualquier usuario
-- Usa auth.jwt() que contiene el rol del usuario autenticado
CREATE POLICY "Admins can update any user"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador')
  WITH CHECK ((auth.jwt()->>'rol')::text = 'Administrador');

-- Nota: Para Gerentes, necesitaríamos validar oficina_id pero eso requeriría
-- una consulta a usuarios que causaría recursión. Por ahora, los gerentes
-- solo pueden actualizar su propio perfil, y el frontend debe manejar
-- la lógica de restricción por oficina.

-- Log de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas UPDATE simplificadas sin recursión';
  RAISE NOTICE '✅ Usuarios: Pueden actualizar su propio perfil';
  RAISE NOTICE '✅ Administradores: Pueden actualizar cualquier usuario';
  RAISE NOTICE '⚠️  Gerentes: Solo pueden actualizar su propio perfil (frontend debe restringir UI)';
END $$;
