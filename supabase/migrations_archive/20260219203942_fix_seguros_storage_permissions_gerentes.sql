/*
  # Fix Seguros Education Storage Permissions for Gerentes

  ## Problema
  1. Gerentes con permisos en seguros_education no pueden subir videos/miniaturas
  2. Error: "new row violates row-level security policy" en storage.objects
  3. Las políticas de storage solo permiten Administradores

  ## Solución
  - Actualizar políticas de storage para incluir Gerentes con permisos
  - Aplicar a los buckets: seguros-videos y seguros-thumbnails
  - Usar la función tiene_permiso_admin_en_modulo()

  ## Buckets Afectados
  - seguros-videos
  - seguros-thumbnails
*/

-- =====================================================
-- 1. ACTUALIZAR POLÍTICAS DE seguros-videos
-- =====================================================

-- Eliminar políticas antiguas que solo permiten Administradores
DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;

-- Crear nuevas políticas que permiten Admins Y Gerentes con permisos
CREATE POLICY "Admins and authorized gerentes can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seguros-videos'
  AND (
    -- Administrador global
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente con permiso adicional en seguros_education
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

CREATE POLICY "Admins and authorized gerentes can update videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seguros-videos'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
)
WITH CHECK (
  bucket_id = 'seguros-videos'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

CREATE POLICY "Admins and authorized gerentes can delete videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seguros-videos'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

-- =====================================================
-- 2. ACTUALIZAR POLÍTICAS DE seguros-thumbnails
-- =====================================================

-- Eliminar políticas antiguas que solo permiten Administradores
DROP POLICY IF EXISTS "Admins can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete thumbnails" ON storage.objects;

-- Crear nuevas políticas que permiten Admins Y Gerentes con permisos
CREATE POLICY "Admins and authorized gerentes can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seguros-thumbnails'
  AND (
    -- Administrador global
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Gerente con permiso adicional en seguros_education
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

CREATE POLICY "Admins and authorized gerentes can update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seguros-thumbnails'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
)
WITH CHECK (
  bucket_id = 'seguros-thumbnails'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

CREATE POLICY "Admins and authorized gerentes can delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seguros-thumbnails'
  AND (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    tiene_permiso_admin_en_modulo(auth.uid(), 'seguros_education')
  )
);

-- =====================================================
-- 3. VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Políticas de Storage actualizadas para seguros_education';
  RAISE NOTICE '   - seguros-videos: Admins + Gerentes con permiso pueden subir/editar/eliminar';
  RAISE NOTICE '   - seguros-thumbnails: Admins + Gerentes con permiso pueden subir/editar/eliminar';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Gerentes con permiso "seguros_education" ahora pueden:';
  RAISE NOTICE '   - Subir videos de lecciones';
  RAISE NOTICE '   - Subir miniaturas';
  RAISE NOTICE '   - Actualizar/eliminar videos y miniaturas';
END $$;