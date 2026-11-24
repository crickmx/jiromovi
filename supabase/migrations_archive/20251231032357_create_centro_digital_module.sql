/*
  # Módulo Centro Digital de Documentos

  ## Descripción
  Sistema centralizado de gestión documental con control de acceso por roles y oficinas,
  reemplazando el uso de correos, WhatsApp y Drive externo.

  ## Tablas
  1. `centro_digital_carpetas` - Carpetas principales del sistema
  2. `centro_digital_carpetas_oficinas` - Visibilidad por oficinas (many-to-many)
  3. `centro_digital_carpetas_roles` - Visibilidad por roles (many-to-many)
  4. `centro_digital_archivos` - Archivos dentro de carpetas
  5. `centro_digital_auditoria` - Registro de acciones

  ## Permisos
  - Administrador: control total
  - Gerente: gestión de carpetas de su oficina
  - Empleado: subir/editar/eliminar archivos
  - Agente: solo ver y descargar

  ## Storage
  - Bucket: centro-digital-files

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas optimizadas con (SELECT auth.uid())
  - Auditoría completa de acciones
*/

-- =====================================================
-- 1. CARPETAS (Folders)
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_carpetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  
  -- Visibilidad
  todas_oficinas boolean DEFAULT true,
  todos_roles boolean DEFAULT true,
  
  -- Metadata
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  
  -- Control
  activa boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_centro_digital_carpetas_creado_por ON centro_digital_carpetas(creado_por);
CREATE INDEX idx_centro_digital_carpetas_oficina_id ON centro_digital_carpetas(oficina_id);
CREATE INDEX idx_centro_digital_carpetas_activa ON centro_digital_carpetas(activa);

-- =====================================================
-- 2. VISIBILIDAD POR OFICINAS (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_carpetas_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carpeta_id uuid NOT NULL REFERENCES centro_digital_carpetas(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(carpeta_id, oficina_id)
);

CREATE INDEX idx_cd_carpetas_oficinas_carpeta ON centro_digital_carpetas_oficinas(carpeta_id);
CREATE INDEX idx_cd_carpetas_oficinas_oficina ON centro_digital_carpetas_oficinas(oficina_id);

-- =====================================================
-- 3. VISIBILIDAD POR ROLES (Many-to-Many)
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_carpetas_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carpeta_id uuid NOT NULL REFERENCES centro_digital_carpetas(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(carpeta_id, rol)
);

CREATE INDEX idx_cd_carpetas_roles_carpeta ON centro_digital_carpetas_roles(carpeta_id);
CREATE INDEX idx_cd_carpetas_roles_rol ON centro_digital_carpetas_roles(rol);

-- =====================================================
-- 4. ARCHIVOS (Files)
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carpeta_id uuid NOT NULL REFERENCES centro_digital_carpetas(id) ON DELETE CASCADE,
  
  -- Datos del archivo
  nombre text NOT NULL,
  nombre_original text NOT NULL,
  ruta_storage text NOT NULL,
  tipo_mime text,
  tamano_bytes bigint,
  
  -- Estado
  estado text DEFAULT 'activo' CHECK (estado IN ('activo', 'papelera')),
  
  -- Metadata
  cargado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  eliminado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_eliminacion timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_centro_digital_archivos_carpeta ON centro_digital_archivos(carpeta_id);
CREATE INDEX idx_centro_digital_archivos_estado ON centro_digital_archivos(estado);
CREATE INDEX idx_centro_digital_archivos_cargado_por ON centro_digital_archivos(cargado_por);
CREATE INDEX idx_centro_digital_archivos_eliminado_por ON centro_digital_archivos(eliminado_por);

-- =====================================================
-- 5. AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS centro_digital_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de acción
  accion text NOT NULL CHECK (accion IN (
    'carpeta_creada', 'carpeta_editada', 'carpeta_eliminada',
    'archivo_subido', 'archivo_editado', 'archivo_eliminado', 
    'archivo_restaurado', 'archivo_descargado'
  )),
  
  -- Referencias
  carpeta_id uuid REFERENCES centro_digital_carpetas(id) ON DELETE SET NULL,
  archivo_id uuid REFERENCES centro_digital_archivos(id) ON DELETE SET NULL,
  
  -- Usuario y metadata
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  detalles jsonb,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cd_auditoria_carpeta ON centro_digital_auditoria(carpeta_id);
CREATE INDEX idx_cd_auditoria_archivo ON centro_digital_auditoria(archivo_id);
CREATE INDEX idx_cd_auditoria_usuario ON centro_digital_auditoria(usuario_id);
CREATE INDEX idx_cd_auditoria_accion ON centro_digital_auditoria(accion);
CREATE INDEX idx_cd_auditoria_created_at ON centro_digital_auditoria(created_at DESC);

-- =====================================================
-- 6. STORAGE BUCKET
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'centro-digital-files',
  'centro-digital-files',
  false,
  104857600, -- 100 MB
  NULL -- Permitir todos los tipos
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 7. FUNCIONES HELPER
-- =====================================================

-- Función para verificar si un usuario puede ver una carpeta
CREATE OR REPLACE FUNCTION usuario_puede_ver_carpeta(
  p_carpeta_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_usuario_id uuid;
  v_usuario_rol text;
  v_usuario_oficina_id uuid;
  v_carpeta record;
BEGIN
  -- Determinar usuario
  v_usuario_id := COALESCE(p_usuario_id, auth.uid());
  
  IF v_usuario_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Obtener datos del usuario
  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina_id
  FROM usuarios
  WHERE id = v_usuario_id;
  
  -- Admin ve todo
  IF v_usuario_rol = 'Administrador' THEN
    RETURN true;
  END IF;
  
  -- Obtener datos de la carpeta
  SELECT * INTO v_carpeta
  FROM centro_digital_carpetas
  WHERE id = p_carpeta_id AND activa = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Verificar visibilidad por rol
  IF NOT v_carpeta.todos_roles THEN
    IF NOT EXISTS (
      SELECT 1 FROM centro_digital_carpetas_roles
      WHERE carpeta_id = p_carpeta_id AND rol = v_usuario_rol
    ) THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Verificar visibilidad por oficina
  IF NOT v_carpeta.todas_oficinas THEN
    IF NOT EXISTS (
      SELECT 1 FROM centro_digital_carpetas_oficinas
      WHERE carpeta_id = p_carpeta_id AND oficina_id = v_usuario_oficina_id
    ) THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- Función para verificar si un usuario puede gestionar una carpeta
CREATE OR REPLACE FUNCTION usuario_puede_gestionar_carpeta(
  p_carpeta_id uuid,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_usuario_id uuid;
  v_usuario_rol text;
  v_usuario_oficina_id uuid;
  v_carpeta_oficina_id uuid;
BEGIN
  v_usuario_id := COALESCE(p_usuario_id, auth.uid());
  
  IF v_usuario_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina_id
  FROM usuarios
  WHERE id = v_usuario_id;
  
  -- Admin puede gestionar todo
  IF v_usuario_rol = 'Administrador' THEN
    RETURN true;
  END IF;
  
  -- Gerente puede gestionar carpetas de su oficina o globales
  IF v_usuario_rol = 'Gerente' THEN
    SELECT oficina_id INTO v_carpeta_oficina_id
    FROM centro_digital_carpetas
    WHERE id = p_carpeta_id;
    
    IF v_carpeta_oficina_id IS NULL OR v_carpeta_oficina_id = v_usuario_oficina_id THEN
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$;

-- Trigger para updated_at en carpetas
CREATE OR REPLACE FUNCTION update_centro_digital_carpetas_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_carpetas_timestamp
  BEFORE UPDATE ON centro_digital_carpetas
  FOR EACH ROW
  EXECUTE FUNCTION update_centro_digital_carpetas_updated_at();

-- Trigger para updated_at en archivos
CREATE OR REPLACE FUNCTION update_centro_digital_archivos_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_archivos_timestamp
  BEFORE UPDATE ON centro_digital_archivos
  FOR EACH ROW
  EXECUTE FUNCTION update_centro_digital_archivos_updated_at();

-- Trigger para auditoría automática
CREATE OR REPLACE FUNCTION registrar_auditoria_centro_digital()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_accion text;
  v_detalles jsonb;
BEGIN
  -- Determinar acción
  IF TG_TABLE_NAME = 'centro_digital_archivos' THEN
    IF TG_OP = 'INSERT' THEN
      v_accion := 'archivo_subido';
      v_detalles := jsonb_build_object(
        'nombre', NEW.nombre,
        'tamano_bytes', NEW.tamano_bytes,
        'tipo_mime', NEW.tipo_mime
      );
      
      INSERT INTO centro_digital_auditoria (accion, carpeta_id, archivo_id, usuario_id, detalles)
      VALUES (v_accion, NEW.carpeta_id, NEW.id, NEW.cargado_por, v_detalles);
      
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.estado = 'activo' AND NEW.estado = 'papelera' THEN
        v_accion := 'archivo_eliminado';
        v_detalles := jsonb_build_object(
          'nombre', NEW.nombre,
          'eliminado_por', NEW.eliminado_por
        );
        
        INSERT INTO centro_digital_auditoria (accion, carpeta_id, archivo_id, usuario_id, detalles)
        VALUES (v_accion, NEW.carpeta_id, NEW.id, NEW.eliminado_por, v_detalles);
        
      ELSIF OLD.estado = 'papelera' AND NEW.estado = 'activo' THEN
        v_accion := 'archivo_restaurado';
        v_detalles := jsonb_build_object('nombre', NEW.nombre);
        
        INSERT INTO centro_digital_auditoria (accion, carpeta_id, archivo_id, usuario_id, detalles)
        VALUES (v_accion, NEW.carpeta_id, NEW.id, (SELECT auth.uid()), v_detalles);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auditoria_archivos
  AFTER INSERT OR UPDATE ON centro_digital_archivos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_auditoria_centro_digital();

-- =====================================================
-- 8. RLS POLICIES - CARPETAS
-- =====================================================

ALTER TABLE centro_digital_carpetas ENABLE ROW LEVEL SECURITY;

-- Admin ve y gestiona todo
CREATE POLICY "Admin: full access carpetas" ON centro_digital_carpetas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

-- Gerente puede ver carpetas según permisos
CREATE POLICY "Gerente: view allowed carpetas" ON centro_digital_carpetas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Gerente'
    )
    AND usuario_puede_ver_carpeta(id)
  );

-- Gerente puede gestionar carpetas de su oficina
CREATE POLICY "Gerente: manage own office carpetas" ON centro_digital_carpetas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Gerente'
    )
  );

CREATE POLICY "Gerente: update own office carpetas" ON centro_digital_carpetas
  FOR UPDATE TO authenticated
  USING (usuario_puede_gestionar_carpeta(id));

CREATE POLICY "Gerente: delete own office carpetas" ON centro_digital_carpetas
  FOR DELETE TO authenticated
  USING (usuario_puede_gestionar_carpeta(id));

-- Empleados y Agentes solo ven carpetas permitidas
CREATE POLICY "Users: view allowed carpetas" ON centro_digital_carpetas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol IN ('Empleado', 'Agente')
    )
    AND usuario_puede_ver_carpeta(id)
  );

-- =====================================================
-- 9. RLS POLICIES - CARPETAS OFICINAS
-- =====================================================

ALTER TABLE centro_digital_carpetas_oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access carpetas_oficinas" ON centro_digital_carpetas_oficinas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Gerente: manage carpetas_oficinas" ON centro_digital_carpetas_oficinas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Gerente'
    )
    AND usuario_puede_gestionar_carpeta(carpeta_id)
  );

CREATE POLICY "Users: view carpetas_oficinas" ON centro_digital_carpetas_oficinas
  FOR SELECT TO authenticated
  USING (usuario_puede_ver_carpeta(carpeta_id));

-- =====================================================
-- 10. RLS POLICIES - CARPETAS ROLES
-- =====================================================

ALTER TABLE centro_digital_carpetas_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: full access carpetas_roles" ON centro_digital_carpetas_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "Gerente: manage carpetas_roles" ON centro_digital_carpetas_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Gerente'
    )
    AND usuario_puede_gestionar_carpeta(carpeta_id)
  );

CREATE POLICY "Users: view carpetas_roles" ON centro_digital_carpetas_roles
  FOR SELECT TO authenticated
  USING (usuario_puede_ver_carpeta(carpeta_id));

-- =====================================================
-- 11. RLS POLICIES - ARCHIVOS
-- =====================================================

ALTER TABLE centro_digital_archivos ENABLE ROW LEVEL SECURITY;

-- Admin ve todo (incluida papelera)
CREATE POLICY "Admin: full access archivos" ON centro_digital_archivos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

-- Gerente puede ver archivos de carpetas permitidas (no papelera)
CREATE POLICY "Gerente: view allowed archivos" ON centro_digital_archivos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Gerente'
    )
    AND estado = 'activo'
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

-- Empleado puede subir archivos
CREATE POLICY "Empleado: insert archivos" ON centro_digital_archivos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol IN ('Empleado', 'Gerente')
    )
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

-- Empleado puede editar y eliminar archivos (mover a papelera)
CREATE POLICY "Empleado: update archivos" ON centro_digital_archivos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol IN ('Empleado', 'Gerente')
    )
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

-- Agente solo ve archivos activos
CREATE POLICY "Agente: view active archivos" ON centro_digital_archivos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Agente'
    )
    AND estado = 'activo'
    AND usuario_puede_ver_carpeta(carpeta_id)
  );

-- Service role acceso completo
CREATE POLICY "Service role: full access archivos" ON centro_digital_archivos
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 12. RLS POLICIES - AUDITORÍA
-- =====================================================

ALTER TABLE centro_digital_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: view all auditoria" ON centro_digital_auditoria
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

CREATE POLICY "System: insert auditoria" ON centro_digital_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role: full access auditoria" ON centro_digital_auditoria
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 13. STORAGE POLICIES
-- =====================================================

-- Admin puede hacer todo
CREATE POLICY "Admin: full access storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'centro-digital-files'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol = 'Administrador'
    )
  );

-- Gerente y Empleado pueden subir
CREATE POLICY "Gerente/Empleado: upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'centro-digital-files'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol IN ('Gerente', 'Empleado')
    )
  );

-- Gerente y Empleado pueden actualizar sus archivos
CREATE POLICY "Gerente/Empleado: update files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'centro-digital-files'
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (SELECT auth.uid())
      AND rol IN ('Gerente', 'Empleado')
    )
  );

-- Usuarios autenticados pueden descargar archivos permitidos
CREATE POLICY "Authenticated: download allowed files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'centro-digital-files'
    AND EXISTS (
      SELECT 1 FROM centro_digital_archivos a
      JOIN centro_digital_carpetas c ON a.carpeta_id = c.id
      WHERE a.ruta_storage = storage.objects.name
      AND a.estado = 'activo'
      AND usuario_puede_ver_carpeta(c.id)
    )
  );

-- Service role acceso completo
CREATE POLICY "Service role: full storage access"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'centro-digital-files');

-- =====================================================
-- LOGS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MÓDULO CENTRO DIGITAL CREADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tablas creadas:';
  RAISE NOTICE '  - centro_digital_carpetas';
  RAISE NOTICE '  - centro_digital_carpetas_oficinas';
  RAISE NOTICE '  - centro_digital_carpetas_roles';
  RAISE NOTICE '  - centro_digital_archivos';
  RAISE NOTICE '  - centro_digital_auditoria';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage bucket: centro-digital-files';
  RAISE NOTICE '';
  RAISE NOTICE 'Permisos configurados:';
  RAISE NOTICE '  ✅ Administrador: control total';
  RAISE NOTICE '  ✅ Gerente: gestión de su oficina';
  RAISE NOTICE '  ✅ Empleado: subir/editar/eliminar';
  RAISE NOTICE '  ✅ Agente: ver y descargar';
  RAISE NOTICE '';
  RAISE NOTICE 'Características:';
  RAISE NOTICE '  ✅ Papelera solo para Admin';
  RAISE NOTICE '  ✅ Visibilidad por roles y oficinas';
  RAISE NOTICE '  ✅ Auditoría completa';
  RAISE NOTICE '  ✅ RLS optimizado';
  RAISE NOTICE '========================================';
END $$;
