/*
  # Fix Centro Digital - Sistema Completo de Permisos de Archivos V2

  ## Problema
  - Los archivos NO tienen sistema de permisos propio
  - La visibilidad solo se basa en carpetas
  - Los usuarios filtrados NO pueden ver archivos asignados a ellos
  
  ## Solución
  1. Agregar tabla de permisos de archivos por usuario
  2. Agregar campos de visibilidad a archivos
  3. Crear funciones de visibilidad PRIMERO
  4. Luego actualizar RLS para usar funciones
*/

-- =====================================================
-- 1. AGREGAR CAMPOS DE VISIBILIDAD A ARCHIVOS
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'centro_digital_archivos' AND column_name = 'visible_para_todos'
  ) THEN
    ALTER TABLE centro_digital_archivos ADD COLUMN visible_para_todos BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'centro_digital_archivos' AND column_name = 'visible_para_oficina'
  ) THEN
    ALTER TABLE centro_digital_archivos ADD COLUMN visible_para_oficina UUID REFERENCES oficinas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 2. CREAR TABLA DE PERMISOS POR USUARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_archivos_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_id UUID NOT NULL REFERENCES centro_digital_archivos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(archivo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_archivos_usuarios_archivo ON centro_digital_archivos_usuarios(archivo_id);
CREATE INDEX IF NOT EXISTS idx_archivos_usuarios_usuario ON centro_digital_archivos_usuarios(usuario_id);

-- =====================================================
-- 3. FUNCIONES DE VISIBILIDAD (CREAR PRIMERO)
-- =====================================================

CREATE OR REPLACE FUNCTION usuario_puede_ver_archivo(
  p_archivo_id UUID,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_usuario_id UUID;
  v_usuario_rol TEXT;
  v_usuario_oficina_id UUID;
  v_archivo RECORD;
BEGIN
  v_usuario_id := COALESCE(p_usuario_id, auth.uid());
  
  IF v_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina_id
  FROM usuarios
  WHERE id = v_usuario_id;

  IF v_usuario_rol = 'Administrador' THEN
    RETURN true;
  END IF;

  SELECT * INTO v_archivo
  FROM centro_digital_archivos
  WHERE id = p_archivo_id AND estado = 'activo';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Creador siempre puede ver
  IF v_archivo.cargado_por = v_usuario_id THEN
    RETURN true;
  END IF;

  -- Visible para todos
  IF v_archivo.visible_para_todos = true THEN
    RETURN true;
  END IF;

  -- Visible para oficina específica
  IF v_archivo.visible_para_oficina IS NOT NULL 
     AND v_archivo.visible_para_oficina = v_usuario_oficina_id THEN
    RETURN true;
  END IF;

  -- Permiso individual
  IF EXISTS (
    SELECT 1 FROM centro_digital_archivos_usuarios
    WHERE archivo_id = p_archivo_id 
      AND usuario_id = v_usuario_id
  ) THEN
    RETURN true;
  END IF;

  -- Hereda visibilidad de carpeta
  IF usuario_puede_ver_carpeta(v_archivo.carpeta_id, v_usuario_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION usuario_puede_gestionar_archivo(
  p_archivo_id UUID,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_usuario_id UUID;
  v_usuario_rol TEXT;
  v_usuario_oficina_id UUID;
  v_archivo RECORD;
BEGIN
  v_usuario_id := COALESCE(p_usuario_id, auth.uid());
  
  IF v_usuario_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina_id
  FROM usuarios
  WHERE id = v_usuario_id;

  IF v_usuario_rol = 'Administrador' THEN
    RETURN true;
  END IF;

  SELECT * INTO v_archivo
  FROM centro_digital_archivos
  WHERE id = p_archivo_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_archivo.cargado_por = v_usuario_id THEN
    RETURN true;
  END IF;

  IF v_usuario_rol = 'Gerente' THEN
    IF v_archivo.visible_para_oficina = v_usuario_oficina_id THEN
      RETURN true;
    END IF;
    
    IF usuario_puede_gestionar_carpeta(v_archivo.carpeta_id, v_usuario_id) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- =====================================================
-- 4. RLS PARA TABLA DE PERMISOS
-- =====================================================

ALTER TABLE centro_digital_archivos_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin: full access archivos_usuarios" ON centro_digital_archivos_usuarios;
DROP POLICY IF EXISTS "Gerente: manage archivos_usuarios for own office" ON centro_digital_archivos_usuarios;
DROP POLICY IF EXISTS "Users: view own permissions" ON centro_digital_archivos_usuarios;

CREATE POLICY "Admin: full access archivos_usuarios"
  ON centro_digital_archivos_usuarios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol = 'Administrador'
    )
  );

CREATE POLICY "Gerente: manage archivos_usuarios for own office"
  ON centro_digital_archivos_usuarios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() 
        AND u.rol = 'Gerente'
        AND usuario_puede_gestionar_archivo(archivo_id)
    )
  );

CREATE POLICY "Users: view own permissions"
  ON centro_digital_archivos_usuarios
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- =====================================================
-- 5. RECREAR POLÍTICAS RLS PARA ARCHIVOS
-- =====================================================

DROP POLICY IF EXISTS "Admin: full access archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Gerente: view allowed archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Agente: view active archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Empleado: insert archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Empleado: update archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Service role: full access archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Users: view allowed archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Staff: insert archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Staff: update own archivos" ON centro_digital_archivos;
DROP POLICY IF EXISTS "Admin or owner: delete archivos" ON centro_digital_archivos;

CREATE POLICY "Users: view allowed archivos"
  ON centro_digital_archivos
  FOR SELECT
  TO authenticated
  USING (usuario_puede_ver_archivo(id));

CREATE POLICY "Staff: insert archivos"
  ON centro_digital_archivos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Empleado')
    )
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

CREATE POLICY "Staff: update own archivos"
  ON centro_digital_archivos
  FOR UPDATE
  TO authenticated
  USING (usuario_puede_gestionar_archivo(id))
  WITH CHECK (usuario_puede_gestionar_archivo(id));

CREATE POLICY "Admin or owner: delete archivos"
  ON centro_digital_archivos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE usuarios.id = auth.uid() 
        AND (usuarios.rol = 'Administrador' OR cargado_por = auth.uid())
    )
  );

CREATE POLICY "Service role: full access archivos"
  ON centro_digital_archivos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 6. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_archivos_visible_todos ON centro_digital_archivos(visible_para_todos) WHERE visible_para_todos = true;
CREATE INDEX IF NOT EXISTS idx_archivos_visible_oficina ON centro_digital_archivos(visible_para_oficina) WHERE visible_para_oficina IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archivos_cargado_por ON centro_digital_archivos(cargado_por);
CREATE INDEX IF NOT EXISTS idx_archivos_carpeta_estado ON centro_digital_archivos(carpeta_id, estado);

-- =====================================================
-- 7. COMENTARIOS
-- =====================================================

COMMENT ON COLUMN centro_digital_archivos.visible_para_todos IS 'Si true, todos los usuarios autenticados pueden ver el archivo';
COMMENT ON COLUMN centro_digital_archivos.visible_para_oficina IS 'Si se especifica, solo usuarios de esta oficina pueden ver el archivo';
COMMENT ON TABLE centro_digital_archivos_usuarios IS 'Permisos individuales por usuario para archivos específicos';
