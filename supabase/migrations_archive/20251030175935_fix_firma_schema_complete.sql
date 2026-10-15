/*
  # Corrección completa del esquema de firmas de email

  ## Problema
  - El esquema actual no coincide con el código del frontend
  - Faltan columnas necesarias: descripcion, html, ancho_max, es_activa
  - Las asignaciones no soportan los tipos: global, oficina, rol, usuario
  - Falta la función get_firma_asignada que funcione correctamente

  ## Solución
  1. Eliminar tablas existentes y recrearlas con el esquema correcto
  2. Crear función RPC para obtener firma asignada por prioridad
  3. Configurar RLS apropiado
  4. Crear índices para mejor performance
*/

-- =============================================
-- PASO 1: Eliminar tablas y funciones existentes
-- =============================================

DROP FUNCTION IF EXISTS get_firma_asignada(uuid);
DROP TABLE IF EXISTS firma_asignaciones CASCADE;
DROP TABLE IF EXISTS firma_imagenes CASCADE;
DROP TABLE IF EXISTS firma_templates CASCADE;

-- =============================================
-- PASO 2: Crear tabla de plantillas de firma
-- =============================================

CREATE TABLE firma_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  html text NOT NULL,
  ancho_max integer DEFAULT 700,
  es_activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_firma_templates_es_activa ON firma_templates(es_activa);

-- RLS
ALTER TABLE firma_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firma_templates_select_all"
  ON firma_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "firma_templates_insert_admin"
  ON firma_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "firma_templates_update_admin"
  ON firma_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "firma_templates_delete_admin"
  ON firma_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

-- =============================================
-- PASO 3: Crear tabla de asignaciones de firma
-- =============================================

CREATE TABLE firma_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES firma_templates(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('global', 'oficina', 'rol', 'usuario')),
  prioridad integer DEFAULT 0,
  ref_oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  ref_rol text,
  ref_usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT check_ref_fields CHECK (
    (tipo = 'global' AND ref_oficina_id IS NULL AND ref_rol IS NULL AND ref_usuario_id IS NULL) OR
    (tipo = 'oficina' AND ref_oficina_id IS NOT NULL AND ref_rol IS NULL AND ref_usuario_id IS NULL) OR
    (tipo = 'rol' AND ref_oficina_id IS NULL AND ref_rol IS NOT NULL AND ref_usuario_id IS NULL) OR
    (tipo = 'usuario' AND ref_oficina_id IS NULL AND ref_rol IS NULL AND ref_usuario_id IS NOT NULL)
  )
);

-- Índices para mejor performance
CREATE INDEX idx_firma_asignaciones_template_id ON firma_asignaciones(template_id);
CREATE INDEX idx_firma_asignaciones_tipo ON firma_asignaciones(tipo);
CREATE INDEX idx_firma_asignaciones_ref_usuario_id ON firma_asignaciones(ref_usuario_id);
CREATE INDEX idx_firma_asignaciones_ref_oficina_id ON firma_asignaciones(ref_oficina_id);
CREATE INDEX idx_firma_asignaciones_ref_rol ON firma_asignaciones(ref_rol);
CREATE INDEX idx_firma_asignaciones_prioridad ON firma_asignaciones(prioridad DESC);

-- RLS
ALTER TABLE firma_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firma_asignaciones_select_all"
  ON firma_asignaciones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "firma_asignaciones_insert_admin"
  ON firma_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "firma_asignaciones_update_admin"
  ON firma_asignaciones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

CREATE POLICY "firma_asignaciones_delete_admin"
  ON firma_asignaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
    )
  );

-- =============================================
-- PASO 4: Crear función para obtener firma asignada
-- =============================================

CREATE OR REPLACE FUNCTION get_firma_asignada(p_usuario_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_nombre text,
  template_html text,
  prioridad integer,
  tipo_asignacion text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario RECORD;
  v_result RECORD;
BEGIN
  -- Obtener datos del usuario
  SELECT * INTO v_usuario
  FROM usuarios
  WHERE id = p_usuario_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- 1. Buscar por usuario específico (prioridad más alta)
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON ft.id = fa.template_id
  WHERE fa.tipo = 'usuario'
    AND fa.ref_usuario_id = p_usuario_id
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_result.id, v_result.nombre, v_result.html, v_result.prioridad, v_result.tipo;
    RETURN;
  END IF;
  
  -- 2. Buscar por rol
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON ft.id = fa.template_id
  WHERE fa.tipo = 'rol'
    AND fa.ref_rol = v_usuario.rol
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_result.id, v_result.nombre, v_result.html, v_result.prioridad, v_result.tipo;
    RETURN;
  END IF;
  
  -- 3. Buscar por oficina
  IF v_usuario.oficina_id IS NOT NULL THEN
    SELECT 
      ft.id,
      ft.nombre,
      ft.html,
      fa.prioridad,
      fa.tipo
    INTO v_result
    FROM firma_asignaciones fa
    JOIN firma_templates ft ON ft.id = fa.template_id
    WHERE fa.tipo = 'oficina'
      AND fa.ref_oficina_id = v_usuario.oficina_id
      AND ft.es_activa = true
    ORDER BY fa.prioridad DESC
    LIMIT 1;
    
    IF FOUND THEN
      RETURN QUERY SELECT v_result.id, v_result.nombre, v_result.html, v_result.prioridad, v_result.tipo;
      RETURN;
    END IF;
  END IF;
  
  -- 4. Buscar firma global (prioridad más baja)
  SELECT 
    ft.id,
    ft.nombre,
    ft.html,
    fa.prioridad,
    fa.tipo
  INTO v_result
  FROM firma_asignaciones fa
  JOIN firma_templates ft ON ft.id = fa.template_id
  WHERE fa.tipo = 'global'
    AND ft.es_activa = true
  ORDER BY fa.prioridad DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT v_result.id, v_result.nombre, v_result.html, v_result.prioridad, v_result.tipo;
    RETURN;
  END IF;
  
  -- No se encontró ninguna firma
  RETURN;
END;
$$;

-- =============================================
-- PASO 5: Trigger para updated_at
-- =============================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_firma_templates
BEFORE UPDATE ON firma_templates
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_firma_asignaciones
BEFORE UPDATE ON firma_asignaciones
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Comentarios
COMMENT ON TABLE firma_templates IS 'Plantillas HTML para firmas de email';
COMMENT ON TABLE firma_asignaciones IS 'Asignaciones de firmas a usuarios, roles, oficinas o globales';
COMMENT ON FUNCTION get_firma_asignada IS 'Obtiene la firma asignada a un usuario según prioridad: usuario > rol > oficina > global';
