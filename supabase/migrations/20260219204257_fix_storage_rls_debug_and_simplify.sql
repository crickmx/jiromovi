/*
  # Depuración y Simplificación de Políticas de Storage

  ## Problema
  - Las políticas de storage parecen correctas pero aún fallan
  - Posible problema con la función SECURITY DEFINER en contexto de RLS de storage
  - Necesitamos simplificar y hacer más explícitas las políticas

  ## Solución
  - Crear función helper inline para storage
  - Simplificar verificación de permisos
  - Recrear políticas con lógica más explícita
*/

-- =====================================================
-- 1. ELIMINAR POLÍTICAS ACTUALES
-- =====================================================

DROP POLICY IF EXISTS "Admins and authorized gerentes can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and authorized gerentes can update videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and authorized gerentes can delete videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins and authorized gerentes can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins and authorized gerentes can update thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Admins and authorized gerentes can delete thumbnails" ON storage.objects;

-- =====================================================
-- 2. CREAR POLÍTICAS SIMPLIFICADAS Y EXPLÍCITAS
-- =====================================================

-- Videos: Upload
CREATE POLICY "Admins and authorized gerentes can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seguros-videos'
  AND (
    -- Es Administrador
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.estado = 'activo'
    )
    OR
    -- Es Gerente con permiso en seguros_education
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- Videos: Update
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- Videos: Delete
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- Thumbnails: Upload
CREATE POLICY "Admins and authorized gerentes can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- Thumbnails: Update
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- Thumbnails: Delete
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
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = auth.uid()
        AND u.rol = 'Gerente'
        AND u.estado = 'activo'
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    )
  )
);

-- =====================================================
-- 3. CREAR FUNCIÓN DE DIAGNÓSTICO
-- =====================================================

CREATE OR REPLACE FUNCTION debug_storage_permissions(p_user_id uuid, p_bucket text)
RETURNS TABLE (
  check_type text,
  passed boolean,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check 1: Usuario existe y está activo
  RETURN QUERY
  SELECT 
    'Usuario activo'::text,
    EXISTS (
      SELECT 1 FROM usuarios WHERE id = p_user_id AND estado = 'activo'
    ),
    COALESCE(
      (SELECT rol || ' - ' || email_laboral FROM usuarios WHERE id = p_user_id),
      'Usuario no encontrado'
    );

  -- Check 2: Es Administrador
  RETURN QUERY
  SELECT 
    'Es Administrador'::text,
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = p_user_id AND rol = 'Administrador' AND estado = 'activo'
    ),
    COALESCE(
      (SELECT rol FROM usuarios WHERE id = p_user_id),
      'N/A'
    );

  -- Check 3: Tiene permiso en seguros_education
  RETURN QUERY
  SELECT 
    'Tiene permiso seguros_education'::text,
    EXISTS (
      SELECT 1 
      FROM usuarios u
      JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
      JOIN modulos_sistema ms ON ms.id = pag.modulo_id
      WHERE u.id = p_user_id
        AND ms.codigo = 'seguros_education'
        AND ms.activo = true
    ),
    COALESCE(
      (SELECT STRING_AGG(ms.codigo, ', ')
       FROM permisos_adicionales_gerente pag
       JOIN modulos_sistema ms ON ms.id = pag.modulo_id
       WHERE pag.usuario_id = p_user_id),
      'Sin permisos adicionales'
    );

  -- Check 4: Debería pasar la política del bucket
  RETURN QUERY
  SELECT 
    'Debería poder subir a ' || p_bucket,
    (
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = p_user_id AND rol = 'Administrador' AND estado = 'activo'
      )
      OR
      EXISTS (
        SELECT 1 
        FROM usuarios u
        JOIN permisos_adicionales_gerente pag ON pag.usuario_id = u.id
        JOIN modulos_sistema ms ON ms.id = pag.modulo_id
        WHERE u.id = p_user_id
          AND u.rol = 'Gerente'
          AND u.estado = 'activo'
          AND ms.codigo = 'seguros_education'
          AND ms.activo = true
      )
    ),
    'Combinación de checks anteriores';
END;
$$;

GRANT EXECUTE ON FUNCTION debug_storage_permissions(uuid, text) TO authenticated;

COMMENT ON FUNCTION debug_storage_permissions IS 
  'Función de diagnóstico para verificar permisos de storage de un usuario';

-- =====================================================
-- 4. LOG DE VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Políticas de storage recreadas con JOINs explícitos';
  RAISE NOTICE '   - Se eliminó dependencia de función tiene_permiso_admin_en_modulo';
  RAISE NOTICE '   - Los JOINs inline son más transparentes para RLS';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Para diagnosticar permisos de un usuario:';
  RAISE NOTICE '   SELECT * FROM debug_storage_permissions(''[UUID]'', ''seguros-videos'');';
END $$;