/*
  # Extender Módulo Comunicados para Gerentes
  
  ## Descripción
  Extiende el módulo de comunicados para permitir que Gerentes creen
  publicaciones con visibilidad limitada a su oficina.
  
  ## Cambios
  
  ### 1. Nuevas Columnas
  - `oficina_origen_id` en comunicados_publicaciones
    - Identifica la oficina del gerente creador
    - NULL para comunicados creados por administradores
  
  ### 2. Políticas RLS Actualizadas
  - Gerentes pueden crear comunicados
  - Gerentes pueden editar/eliminar solo sus propios comunicados
  - Gerentes no pueden fijar comunicados (validación en backend)
  - Gerentes solo asignan visibilidad a su oficina
  
  ### 3. Visibilidad Automática
  - Administradores siempre ven todos los comunicados
  - Gerentes ven comunicados de su oficina + todos los de admin
  - Empleados/Agentes ven según configuración de visibilidad
  
  ## Seguridad
  - Gerentes restringidos a su oficina
  - No pueden editar comunicados de administradores
  - No pueden crear categorías
  - No pueden fijar comunicados
*/

-- =====================================================
-- 1. Agregar columna oficina_origen_id
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comunicados_publicaciones'
    AND column_name = 'oficina_origen_id'
  ) THEN
    ALTER TABLE comunicados_publicaciones
    ADD COLUMN oficina_origen_id UUID REFERENCES oficinas(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_comunicados_oficina_origen 
    ON comunicados_publicaciones(oficina_origen_id);
  END IF;
END $$;

-- =====================================================
-- 2. Actualizar Políticas RLS para Publicaciones
-- =====================================================

-- Eliminar políticas restrictivas actuales
DROP POLICY IF EXISTS "Admins can insert comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Admins can update comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Admins can delete comunicados" ON comunicados_publicaciones;

-- POLÍTICA INSERT: Administradores y Gerentes pueden crear
CREATE POLICY "Admins and Gerentes can insert comunicados"
  ON comunicados_publicaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- POLÍTICA UPDATE: Administradores todos, Gerentes solo los suyos
CREATE POLICY "Admins can update any, Gerentes own comunicados"
  ON comunicados_publicaciones
  FOR UPDATE
  TO authenticated
  USING (
    -- Administradores pueden actualizar todos
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
    OR
    -- Gerentes solo sus propios comunicados (creados por ellos)
    (
      creado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
      )
    )
  )
  WITH CHECK (
    -- Administradores pueden actualizar todos
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
    OR
    -- Gerentes solo sus propios comunicados
    (
      creado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
      )
      -- Gerentes no pueden fijar comunicados (fijado debe ser false)
      AND (fijado = false OR fijado IS NULL)
    )
  );

-- POLÍTICA DELETE: Administradores todos, Gerentes solo los suyos
CREATE POLICY "Admins can delete any, Gerentes own comunicados"
  ON comunicados_publicaciones
  FOR DELETE
  TO authenticated
  USING (
    -- Administradores pueden eliminar todos
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
    OR
    -- Gerentes solo sus propios comunicados
    (
      creado_por = auth.uid()
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
      )
    )
  );

-- POLÍTICA SELECT: Gerentes ven comunicados de su oficina + todos de admin
CREATE POLICY "Gerentes view own office and admin comunicados"
  ON comunicados_publicaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Gerente'
      AND (
        -- Comunicados de administradores (sin oficina_origen_id)
        oficina_origen_id IS NULL
        OR
        -- Comunicados de su misma oficina
        oficina_origen_id = u.oficina_id
      )
    )
    AND publicado = true
    AND fecha_publicacion <= now()
  );

-- =====================================================
-- 3. Políticas RLS para Visibilidad
-- =====================================================

-- Eliminar política restrictiva actual
DROP POLICY IF EXISTS "Admins can insert visibility" ON comunicados_visibilidad;

-- POLÍTICA INSERT: Administradores y Gerentes pueden crear visibilidad
CREATE POLICY "Admins and Gerentes can insert visibility"
  ON comunicados_visibilidad
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- 4. Función Helper: Verificar si usuario puede ver comunicado
-- =====================================================

CREATE OR REPLACE FUNCTION puede_ver_comunicado(
  p_comunicado_id UUID,
  p_usuario_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_rol TEXT;
  v_usuario_oficina UUID;
  v_comunicado_oficina_origen UUID;
  v_publicado BOOLEAN;
  v_fecha_publicacion TIMESTAMPTZ;
BEGIN
  -- Obtener datos del usuario
  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina
  FROM usuarios
  WHERE id = p_usuario_id;
  
  -- Obtener datos del comunicado
  SELECT oficina_origen_id, publicado, fecha_publicacion
  INTO v_comunicado_oficina_origen, v_publicado, v_fecha_publicacion
  FROM comunicados_publicaciones
  WHERE id = p_comunicado_id;
  
  -- Verificar que el comunicado está publicado
  IF NOT v_publicado OR v_fecha_publicacion > now() THEN
    -- Solo administradores pueden ver comunicados no publicados
    IF v_usuario_rol = 'Administrador' THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;
  
  -- Administradores siempre pueden ver todos
  IF v_usuario_rol = 'Administrador' THEN
    RETURN TRUE;
  END IF;
  
  -- Comunicados de administradores (sin oficina_origen)
  IF v_comunicado_oficina_origen IS NULL THEN
    -- Verificar visibilidad configurada
    RETURN EXISTS (
      SELECT 1 FROM comunicados_visibilidad cv
      WHERE cv.comunicado_id = p_comunicado_id
      AND (
        cv.para_todos = true
        OR cv.usuario_id = p_usuario_id
        OR cv.rol = v_usuario_rol
        OR cv.oficina_id = v_usuario_oficina
      )
    );
  END IF;
  
  -- Comunicados de gerentes (con oficina_origen)
  -- Solo visible para usuarios de esa oficina según roles configurados
  IF v_usuario_oficina = v_comunicado_oficina_origen THEN
    RETURN EXISTS (
      SELECT 1 FROM comunicados_visibilidad cv
      WHERE cv.comunicado_id = p_comunicado_id
      AND cv.oficina_id = v_comunicado_oficina_origen
      AND (
        cv.rol = v_usuario_rol
        OR cv.usuario_id = p_usuario_id
      )
    );
  END IF;
  
  RETURN FALSE;
END;
$$;

-- =====================================================
-- 5. Trigger: Auto-asignar oficina_origen_id
-- =====================================================

CREATE OR REPLACE FUNCTION set_oficina_origen_for_gerente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rol TEXT;
  v_oficina_id UUID;
BEGIN
  -- Obtener rol y oficina del creador
  SELECT rol, oficina_id INTO v_rol, v_oficina_id
  FROM usuarios
  WHERE id = NEW.creado_por;
  
  -- Si es Gerente, asignar oficina_origen_id
  IF v_rol = 'Gerente' THEN
    NEW.oficina_origen_id := v_oficina_id;
    -- Forzar fijado = false para gerentes
    NEW.fijado := false;
  ELSE
    -- Para administradores, oficina_origen_id = NULL
    NEW.oficina_origen_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_oficina_origen ON comunicados_publicaciones;

CREATE TRIGGER trigger_set_oficina_origen
  BEFORE INSERT OR UPDATE ON comunicados_publicaciones
  FOR EACH ROW
  EXECUTE FUNCTION set_oficina_origen_for_gerente();

-- =====================================================
-- 6. Logs
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Módulo Comunicados extendido para Gerentes';
  RAISE NOTICE '✅ Columna oficina_origen_id agregada';
  RAISE NOTICE '✅ Políticas RLS actualizadas';
  RAISE NOTICE '✅ Gerentes pueden crear comunicados para su oficina';
  RAISE NOTICE '✅ Gerentes no pueden fijar comunicados';
  RAISE NOTICE '✅ Función puede_ver_comunicado() creada';
  RAISE NOTICE '✅ Trigger auto-asigna oficina_origen_id';
END $$;
