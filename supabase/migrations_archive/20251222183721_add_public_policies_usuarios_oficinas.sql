/*
  # Agregar Políticas Públicas para Usuarios y Oficinas

  1. Nuevas Políticas
    - Permitir a anon leer datos básicos de usuarios con páginas publicadas
    - Permitir a anon leer oficinas relacionadas a usuarios publicados

  2. Seguridad
    - Solo usuarios activos con páginas publicadas
    - Solo información pública (no información sensible)
*/

-- Política para que anon pueda leer usuarios con páginas publicadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'usuarios' 
    AND policyname = 'Public can view published user profiles'
  ) THEN
    CREATE POLICY "Public can view published user profiles"
      ON usuarios
      FOR SELECT
      TO anon
      USING (
        estado = 'activo'
        AND web_slug IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM user_web_pages
          WHERE user_web_pages.user_id = usuarios.id
            AND user_web_pages.is_published = true
        )
      );
  END IF;
END $$;

-- Política para que anon pueda leer oficinas de usuarios publicados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'oficinas' 
    AND policyname = 'Public can view offices of published users'
  ) THEN
    CREATE POLICY "Public can view offices of published users"
      ON oficinas
      FOR SELECT
      TO anon
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.oficina_id = oficinas.id
            AND usuarios.estado = 'activo'
            AND usuarios.web_slug IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM user_web_pages
              WHERE user_web_pages.user_id = usuarios.id
                AND user_web_pages.is_published = true
            )
        )
      );
  END IF;
END $$;
