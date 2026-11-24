/*
  # Corregir Política de Visibilidad de Comunicados

  1. Problema
    - La política RLS no considera correctamente el campo `para_todos`
    - Los usuarios normales no ven comunicados cuando deberían

  2. Solución
    - Mejorar la política "Users can view comunicados based on visibility"
    - Incluir lógica para `para_todos = true`
    - Optimizar con (select auth.uid()) para mejor rendimiento

  3. Lógica de Visibilidad
    - Si NO hay reglas de visibilidad → Visible para todos
    - Si hay regla con `para_todos = true` → Visible para todos
    - Si hay reglas específicas → Verificar rol/oficina/usuario
*/

-- =====================================================
-- OPTIMIZAR POLÍTICAS DE COMUNICADOS
-- =====================================================

-- Drop todas las políticas SELECT existentes
DROP POLICY IF EXISTS "Admins can view all comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Gerentes view own office and admin comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Users can view comunicados based on visibility" ON comunicados_publicaciones;

-- Política para Administradores (ven todo)
CREATE POLICY "Admins can view all comunicados"
  ON comunicados_publicaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol = 'Administrador'
    )
  );

-- Política para Gerentes (ven de su oficina y los de admin)
CREATE POLICY "Gerentes view own office and admin comunicados"
  ON comunicados_publicaciones FOR SELECT
  TO authenticated
  USING (
    publicado = true
    AND fecha_publicacion <= now()
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND u.rol = 'Gerente'
      AND (
        comunicados_publicaciones.oficina_origen_id IS NULL
        OR comunicados_publicaciones.oficina_origen_id = u.oficina_id
      )
    )
  );

-- Política mejorada para usuarios normales
CREATE POLICY "Users can view comunicados based on visibility"
  ON comunicados_publicaciones FOR SELECT
  TO authenticated
  USING (
    publicado = true
    AND fecha_publicacion <= now()
    AND (
      -- Caso 1: No hay reglas de visibilidad definidas (visible para todos)
      NOT EXISTS (
        SELECT 1 FROM comunicados_visibilidad
        WHERE comunicado_id = comunicados_publicaciones.id
      )
      OR
      -- Caso 2: Existe una regla explícita de "para todos"
      EXISTS (
        SELECT 1 FROM comunicados_visibilidad
        WHERE comunicado_id = comunicados_publicaciones.id
        AND para_todos = true
      )
      OR
      -- Caso 3: El usuario cumple con alguna regla específica
      EXISTS (
        SELECT 1 
        FROM comunicados_visibilidad cv
        JOIN usuarios u ON u.id = (select auth.uid())
        WHERE cv.comunicado_id = comunicados_publicaciones.id
        AND (
          -- Coincide con el rol del usuario
          (cv.rol IS NOT NULL AND cv.rol = u.rol)
          OR
          -- Coincide con la oficina del usuario
          (cv.oficina_id IS NOT NULL AND cv.oficina_id = u.oficina_id)
          OR
          -- Es específico para este usuario
          (cv.usuario_id IS NOT NULL AND cv.usuario_id = u.id)
        )
      )
    )
  );

-- =====================================================
-- OPTIMIZAR POLÍTICAS DE INSERT/UPDATE/DELETE
-- =====================================================

DROP POLICY IF EXISTS "Admins and Gerentes can insert comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Admins can update any, Gerentes own comunicados" ON comunicados_publicaciones;
DROP POLICY IF EXISTS "Admins can delete any, Gerentes own comunicados" ON comunicados_publicaciones;

CREATE POLICY "Admins and Gerentes can insert comunicados"
  ON comunicados_publicaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Admins can update any, Gerentes own comunicados"
  ON comunicados_publicaciones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol = 'Administrador'
    )
    OR
    (
      creado_por = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = (select auth.uid())
        AND rol = 'Gerente'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol = 'Administrador'
    )
    OR
    (
      creado_por = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = (select auth.uid())
        AND rol = 'Gerente'
      )
      AND (fijado = false OR fijado IS NULL)
    )
  );

CREATE POLICY "Admins can delete any, Gerentes own comunicados"
  ON comunicados_publicaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol = 'Administrador'
    )
    OR
    (
      creado_por = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = (select auth.uid())
        AND rol = 'Gerente'
      )
    )
  );

-- =====================================================
-- OPTIMIZAR POLÍTICAS DE COMUNICADOS_VISIBILIDAD
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage visibility" ON comunicados_visibilidad;
DROP POLICY IF EXISTS "Admins and Gerentes can insert visibility" ON comunicados_visibilidad;
DROP POLICY IF EXISTS "Anyone can view visibility rules" ON comunicados_visibilidad;

CREATE POLICY "Admins and Gerentes can manage visibility"
  ON comunicados_visibilidad
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol IN ('Administrador', 'Gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid())
      AND rol IN ('Administrador', 'Gerente')
    )
  );

CREATE POLICY "Anyone can view visibility rules"
  ON comunicados_visibilidad FOR SELECT
  TO authenticated
  USING (true);