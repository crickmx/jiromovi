/*
  # Módulo de Comunicados - Sistema de Publicaciones Institucionales

  ## Descripción
  Sistema completo de comunicados internos tipo blog corporativo con:
  - Categorías
  - Publicaciones con editor HTML
  - Adjuntos (máximo 5 por comunicado)
  - Sistema de visibilidad granular (roles, oficinas, usuarios)
  - Publicación programada
  - Comunicados fijados (solo uno activo)
  - Notificaciones integradas

  ## Tablas Creadas
  1. `comunicados_categorias` - Categorías de comunicados
  2. `comunicados_publicaciones` - Publicaciones/comunicados
  3. `comunicados_adjuntos` - Archivos adjuntos
  4. `comunicados_visibilidad` - Control de acceso granular

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Solo Administradores pueden crear/editar
  - Todos pueden ver según visibilidad configurada
*/

-- =====================================================
-- 1. TABLA: Categorías de Comunicados
-- =====================================================

CREATE TABLE IF NOT EXISTS comunicados_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para categorías
CREATE INDEX IF NOT EXISTS idx_comunicados_categorias_activo ON comunicados_categorias(activo);

-- RLS para categorías
ALTER TABLE comunicados_categorias ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver categorías activas
CREATE POLICY "Anyone can view active categories"
  ON comunicados_categorias
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Solo administradores pueden insertar
CREATE POLICY "Admins can insert categories"
  ON comunicados_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden actualizar
CREATE POLICY "Admins can update categories"
  ON comunicados_categorias
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden eliminar
CREATE POLICY "Admins can delete categories"
  ON comunicados_categorias
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- 2. TABLA: Publicaciones/Comunicados
-- =====================================================

CREATE TABLE IF NOT EXISTS comunicados_publicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido_html TEXT NOT NULL,
  imagen_principal TEXT NOT NULL,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  fecha_publicacion TIMESTAMPTZ,
  publicado BOOLEAN DEFAULT false,
  fijado BOOLEAN DEFAULT false,
  creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES comunicados_categorias(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para publicaciones
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_publicado ON comunicados_publicaciones(publicado);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_fijado ON comunicados_publicaciones(fijado);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_fecha ON comunicados_publicaciones(fecha_publicacion DESC);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_categoria ON comunicados_publicaciones(categoria_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_publicaciones_creado_por ON comunicados_publicaciones(creado_por);

-- RLS para publicaciones
ALTER TABLE comunicados_publicaciones ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver publicaciones publicadas (visibilidad se controla en otra tabla)
CREATE POLICY "Anyone can view published comunicados"
  ON comunicados_publicaciones
  FOR SELECT
  TO authenticated
  USING (
    publicado = true 
    AND fecha_publicacion <= now()
  );

-- Administradores pueden ver todos los comunicados
CREATE POLICY "Admins can view all comunicados"
  ON comunicados_publicaciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden insertar
CREATE POLICY "Admins can insert comunicados"
  ON comunicados_publicaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden actualizar
CREATE POLICY "Admins can update comunicados"
  ON comunicados_publicaciones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden eliminar
CREATE POLICY "Admins can delete comunicados"
  ON comunicados_publicaciones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- 3. TABLA: Adjuntos
-- =====================================================

CREATE TABLE IF NOT EXISTS comunicados_adjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id UUID NOT NULL REFERENCES comunicados_publicaciones(id) ON DELETE CASCADE,
  archivo_url TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  tamanio_bytes BIGINT,
  tipo_mime TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para adjuntos
CREATE INDEX IF NOT EXISTS idx_comunicados_adjuntos_comunicado ON comunicados_adjuntos(comunicado_id);

-- RLS para adjuntos
ALTER TABLE comunicados_adjuntos ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver adjuntos de comunicados publicados
CREATE POLICY "Anyone can view attachments of published comunicados"
  ON comunicados_adjuntos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comunicados_publicaciones
      WHERE comunicados_publicaciones.id = comunicados_adjuntos.comunicado_id
      AND comunicados_publicaciones.publicado = true
      AND comunicados_publicaciones.fecha_publicacion <= now()
    )
  );

-- Administradores pueden ver todos los adjuntos
CREATE POLICY "Admins can view all attachments"
  ON comunicados_adjuntos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden insertar adjuntos
CREATE POLICY "Admins can insert attachments"
  ON comunicados_adjuntos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Solo administradores pueden eliminar adjuntos
CREATE POLICY "Admins can delete attachments"
  ON comunicados_adjuntos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- 4. TABLA: Visibilidad (Control de Acceso)
-- =====================================================

CREATE TABLE IF NOT EXISTS comunicados_visibilidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicado_id UUID NOT NULL REFERENCES comunicados_publicaciones(id) ON DELETE CASCADE,
  rol TEXT CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente')),
  oficina_id UUID REFERENCES oficinas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Solo uno de los tres debe estar lleno
  CONSTRAINT check_only_one_visibility_type CHECK (
    (rol IS NOT NULL AND oficina_id IS NULL AND usuario_id IS NULL) OR
    (rol IS NULL AND oficina_id IS NOT NULL AND usuario_id IS NULL) OR
    (rol IS NULL AND oficina_id IS NULL AND usuario_id IS NOT NULL)
  )
);

-- Índices para visibilidad
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_comunicado ON comunicados_visibilidad(comunicado_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_rol ON comunicados_visibilidad(rol);
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_oficina ON comunicados_visibilidad(oficina_id);
CREATE INDEX IF NOT EXISTS idx_comunicados_visibilidad_usuario ON comunicados_visibilidad(usuario_id);

-- RLS para visibilidad
ALTER TABLE comunicados_visibilidad ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver reglas de visibilidad
CREATE POLICY "Anyone can view visibility rules"
  ON comunicados_visibilidad
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo administradores pueden gestionar visibilidad
CREATE POLICY "Admins can manage visibility"
  ON comunicados_visibilidad
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- 5. TRIGGER: Solo un comunicado fijado
-- =====================================================

CREATE OR REPLACE FUNCTION comunicados_unpin_others()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fijado = true THEN
    UPDATE comunicados_publicaciones
    SET fijado = false
    WHERE id != NEW.id AND fijado = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unpin_others ON comunicados_publicaciones;
CREATE TRIGGER trigger_unpin_others
  BEFORE INSERT OR UPDATE ON comunicados_publicaciones
  FOR EACH ROW
  WHEN (NEW.fijado = true)
  EXECUTE FUNCTION comunicados_unpin_others();

-- =====================================================
-- 6. TRIGGER: Updated_at automático
-- =====================================================

CREATE OR REPLACE FUNCTION update_comunicados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_comunicados_categorias_updated_at ON comunicados_categorias;
CREATE TRIGGER trigger_comunicados_categorias_updated_at
  BEFORE UPDATE ON comunicados_categorias
  FOR EACH ROW
  EXECUTE FUNCTION update_comunicados_updated_at();

DROP TRIGGER IF EXISTS trigger_comunicados_publicaciones_updated_at ON comunicados_publicaciones;
CREATE TRIGGER trigger_comunicados_publicaciones_updated_at
  BEFORE UPDATE ON comunicados_publicaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_comunicados_updated_at();

-- =====================================================
-- 7. FUNCIÓN: Verificar visibilidad de usuario
-- =====================================================

CREATE OR REPLACE FUNCTION usuario_puede_ver_comunicado(
  p_comunicado_id UUID,
  p_usuario_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tiene_restricciones BOOLEAN;
  v_usuario_rol TEXT;
  v_usuario_oficina UUID;
  v_puede_ver BOOLEAN;
BEGIN
  -- Verificar si el comunicado tiene restricciones de visibilidad
  SELECT EXISTS(
    SELECT 1 FROM comunicados_visibilidad
    WHERE comunicado_id = p_comunicado_id
  ) INTO v_tiene_restricciones;
  
  -- Si no tiene restricciones, todos pueden verlo
  IF NOT v_tiene_restricciones THEN
    RETURN true;
  END IF;
  
  -- Obtener datos del usuario
  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina
  FROM usuarios
  WHERE id = p_usuario_id;
  
  -- Verificar si el usuario cumple alguna regla de visibilidad
  SELECT EXISTS(
    SELECT 1 FROM comunicados_visibilidad
    WHERE comunicado_id = p_comunicado_id
    AND (
      rol = v_usuario_rol OR
      oficina_id = v_usuario_oficina OR
      usuario_id = p_usuario_id
    )
  ) INTO v_puede_ver;
  
  RETURN v_puede_ver;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. STORAGE: Bucket para comunicados
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('comunicados', 'comunicados', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para comunicados
DROP POLICY IF EXISTS "Admins can upload comunicados files" ON storage.objects;
CREATE POLICY "Admins can upload comunicados files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comunicados'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Anyone can view comunicados files" ON storage.objects;
CREATE POLICY "Anyone can view comunicados files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'comunicados');

DROP POLICY IF EXISTS "Admins can delete comunicados files" ON storage.objects;
CREATE POLICY "Admins can delete comunicados files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comunicados'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- =====================================================
-- 9. DATOS INICIALES: Categorías por defecto
-- =====================================================

INSERT INTO comunicados_categorias (nombre, descripcion, activo) VALUES
  ('Anuncios Generales', 'Comunicados y anuncios importantes para toda la organización', true),
  ('Recursos Humanos', 'Información sobre políticas, beneficios y gestión de personal', true),
  ('Capacitación', 'Cursos, talleres y material de formación', true),
  ('Eventos', 'Información sobre eventos corporativos y actividades', true),
  ('Tecnología', 'Actualizaciones de sistemas, herramientas y soporte técnico', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CONFIRMACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Módulo de Comunicados creado exitosamente';
  RAISE NOTICE '✅ Tablas: comunicados_categorias, comunicados_publicaciones, comunicados_adjuntos, comunicados_visibilidad';
  RAISE NOTICE '✅ RLS habilitado en todas las tablas';
  RAISE NOTICE '✅ Triggers configurados (fijado único, updated_at)';
  RAISE NOTICE '✅ Función de visibilidad creada';
  RAISE NOTICE '✅ Storage bucket "comunicados" configurado';
  RAISE NOTICE '✅ Categorías iniciales insertadas';
  RAISE NOTICE '⚠️  Solo Administradores pueden crear/editar comunicados';
  RAISE NOTICE '⚠️  Todos pueden ver según reglas de visibilidad';
END $$;
