/*
  # Sistema de Permisos Adicionales para Gerentes

  1. Objetivo
    - Permitir que usuarios con rol "Gerente" tengan permisos de Administrador en módulos específicos
    - Sin convertirlos en administradores globales
    - Control fino por área/módulo

  2. Nuevas Tablas
    - `modulos_sistema` - Catálogo de módulos de la plataforma
    - `permisos_adicionales_gerente` - Asignación de permisos admin por módulo para gerentes

  3. Funciones de Ayuda
    - `tiene_permiso_admin_en_modulo(user_id, modulo_codigo)` - Verifica si un gerente tiene permisos admin en un módulo
    - `get_permisos_adicionales_usuario(user_id)` - Obtiene lista de módulos con permisos adicionales

  4. Seguridad
    - RLS habilitado en todas las tablas
    - Solo administradores pueden asignar permisos adicionales
    - Logs de auditoría
*/

-- =====================================================
-- 1. TABLA: CATÁLOGO DE MÓDULOS DEL SISTEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS modulos_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  categoria text,
  activo boolean DEFAULT true,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE modulos_sistema IS 'Catálogo de módulos de la plataforma para gestión de permisos granulares';
COMMENT ON COLUMN modulos_sistema.codigo IS 'Identificador único del módulo (ej: "comisiones", "vacaciones")';
COMMENT ON COLUMN modulos_sistema.categoria IS 'Categoría del módulo (ej: "RRHH", "Ventas", "Operaciones")';

-- =====================================================
-- 2. TABLA: PERMISOS ADICIONALES PARA GERENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS permisos_adicionales_gerente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES modulos_sistema(id) ON DELETE CASCADE,
  nivel_permiso text DEFAULT 'admin' CHECK (nivel_permiso IN ('admin')),
  asignado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_asignacion timestamptz DEFAULT now(),
  notas text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, modulo_id)
);

COMMENT ON TABLE permisos_adicionales_gerente IS 'Permisos adicionales de nivel Admin para usuarios Gerente en módulos específicos';
COMMENT ON COLUMN permisos_adicionales_gerente.nivel_permiso IS 'Nivel de permiso otorgado (actualmente solo "admin")';
COMMENT ON COLUMN permisos_adicionales_gerente.asignado_por IS 'Usuario administrador que asignó el permiso';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_permisos_usuario ON permisos_adicionales_gerente(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_modulo ON permisos_adicionales_gerente(modulo_id);
CREATE INDEX IF NOT EXISTS idx_permisos_usuario_modulo ON permisos_adicionales_gerente(usuario_id, modulo_id);

-- =====================================================
-- 3. INSERTAR MÓDULOS DEL SISTEMA
-- =====================================================

INSERT INTO modulos_sistema (codigo, nombre, descripcion, categoria, orden) VALUES
  -- RRHH
  ('vacaciones', 'Vacaciones', 'Gestión de vacaciones y permisos', 'RRHH', 10),
  ('usuarios', 'Usuarios', 'Gestión de usuarios y perfiles', 'RRHH', 20),
  ('directorio', 'Directorio', 'Directorio de empleados', 'RRHH', 30),
  
  -- Ventas y Comisiones
  ('comisiones', 'Comisiones', 'Gestión de comisiones y pagos', 'Ventas', 100),
  ('produccion', 'Producción', 'Reportes de producción de ventas', 'Ventas', 110),
  ('crm', 'CRM', 'Gestión de clientes y oportunidades', 'Ventas', 120),
  
  -- Operaciones
  ('tramites', 'Trámites', 'Gestión de trámites y tickets', 'Operaciones', 200),
  ('store', 'Store', 'Tienda interna y pedidos', 'Operaciones', 210),
  ('espaciojiro', 'Espacio JIRO', 'Reservas de espacios', 'Operaciones', 220),
  
  -- Educación y Capacitación
  ('seguros_education', 'Seguros Education', 'Plataforma de capacitación', 'Educación', 300),
  ('cedula_a', 'Cédula A', 'Curso de certificación Cédula A', 'Educación', 310),
  ('aula_virtual', 'Aula Virtual', 'Sesiones en vivo y webinars', 'Educación', 320),
  
  -- Marketing y Comunicación
  ('publicidad', 'Publicidad', 'Gestión de materiales publicitarios', 'Marketing', 400),
  ('comunicados', 'Comunicados', 'Comunicados internos', 'Marketing', 410),
  ('mi_pagina_web', 'Mi Página Web', 'Editor de página web personal', 'Marketing', 420),
  
  -- Accesos y Configuración
  ('accesos_nacional', 'Accesos Nacional', 'Credenciales de portales aseguradoras', 'Configuración', 500),
  ('notificaciones', 'Notificaciones', 'Configuración de notificaciones', 'Configuración', 510),
  ('correos', 'Correos', 'Gestión de correos electrónicos', 'Configuración', 520),
  ('oficinas', 'Oficinas', 'Gestión de oficinas', 'Configuración', 530),
  
  -- Otros
  ('centro_digital', 'Centro Digital', 'Documentos y archivos compartidos', 'Otros', 600),
  ('gmm_cotizador', 'Cotizador GMM', 'Cotizador de seguros de gastos médicos', 'Otros', 610),
  ('multicotizador', 'Multicotizador', 'Multicotizador de seguros', 'Otros', 620),
  ('sicas', 'SICAS', 'Integración con SICAS', 'Otros', 630)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- 4. FUNCIÓN: VERIFICAR PERMISO ADMIN EN MÓDULO
-- =====================================================

CREATE OR REPLACE FUNCTION tiene_permiso_admin_en_modulo(
  p_usuario_id uuid,
  p_modulo_codigo text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rol text;
  v_tiene_permiso boolean;
BEGIN
  -- Obtener rol del usuario
  SELECT rol INTO v_rol
  FROM usuarios
  WHERE id = p_usuario_id AND estado = 'activo';

  -- Si no existe el usuario o está inactivo, no tiene permiso
  IF v_rol IS NULL THEN
    RETURN false;
  END IF;

  -- Si es Administrador, siempre tiene permiso
  IF v_rol = 'Administrador' THEN
    RETURN true;
  END IF;

  -- Si NO es Gerente, no tiene permisos adicionales
  IF v_rol != 'Gerente' THEN
    RETURN false;
  END IF;

  -- Si es Gerente, verificar si tiene permiso adicional en ese módulo
  SELECT EXISTS (
    SELECT 1
    FROM permisos_adicionales_gerente pag
    JOIN modulos_sistema ms ON ms.id = pag.modulo_id
    WHERE pag.usuario_id = p_usuario_id
      AND ms.codigo = p_modulo_codigo
      AND ms.activo = true
  ) INTO v_tiene_permiso;

  RETURN COALESCE(v_tiene_permiso, false);
END;
$$;

COMMENT ON FUNCTION tiene_permiso_admin_en_modulo IS 'Verifica si un usuario tiene permisos de Administrador en un módulo específico. Retorna true si es Admin global o Gerente con permiso adicional.';

-- =====================================================
-- 5. FUNCIÓN: OBTENER PERMISOS ADICIONALES DE USUARIO
-- =====================================================

CREATE OR REPLACE FUNCTION get_permisos_adicionales_usuario(p_usuario_id uuid)
RETURNS TABLE (
  modulo_id uuid,
  modulo_codigo text,
  modulo_nombre text,
  categoria text,
  fecha_asignacion timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ms.id,
    ms.codigo,
    ms.nombre,
    ms.categoria,
    pag.fecha_asignacion
  FROM permisos_adicionales_gerente pag
  JOIN modulos_sistema ms ON ms.id = pag.modulo_id
  WHERE pag.usuario_id = p_usuario_id
    AND ms.activo = true
  ORDER BY ms.orden, ms.nombre;
END;
$$;

COMMENT ON FUNCTION get_permisos_adicionales_usuario IS 'Retorna lista de módulos donde el usuario tiene permisos adicionales de Admin';

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================

-- Habilitar RLS
ALTER TABLE modulos_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_adicionales_gerente ENABLE ROW LEVEL SECURITY;

-- RLS: modulos_sistema
-- Todos pueden ver módulos activos
CREATE POLICY "Todos pueden ver modulos activos"
  ON modulos_sistema FOR SELECT
  TO authenticated
  USING (activo = true);

-- Solo administradores pueden modificar módulos
CREATE POLICY "Solo administradores pueden modificar modulos"
  ON modulos_sistema FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- RLS: permisos_adicionales_gerente
-- Administradores pueden ver todos los permisos
CREATE POLICY "Administradores pueden ver todos los permisos adicionales"
  ON permisos_adicionales_gerente FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- Usuarios pueden ver sus propios permisos
CREATE POLICY "Usuarios pueden ver sus propios permisos adicionales"
  ON permisos_adicionales_gerente FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Solo administradores pueden asignar/modificar permisos
CREATE POLICY "Solo administradores pueden gestionar permisos adicionales"
  ON permisos_adicionales_gerente FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'Administrador' AND estado = 'activo'
    )
  );

-- =====================================================
-- 7. TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Trigger para updated_at en modulos_sistema
CREATE OR REPLACE FUNCTION actualizar_updated_at_modulos_sistema()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_updated_at_modulos_sistema
  BEFORE UPDATE ON modulos_sistema
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at_modulos_sistema();

-- =====================================================
-- 8. PERMISOS A FUNCIONES
-- =====================================================

GRANT EXECUTE ON FUNCTION tiene_permiso_admin_en_modulo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_permisos_adicionales_usuario(uuid) TO authenticated;

-- =====================================================
-- 9. COMENTARIOS FINALES
-- =====================================================

COMMENT ON FUNCTION tiene_permiso_admin_en_modulo IS 'SECURITY DEFINER: Usa privilegios del owner para bypass de RLS al verificar permisos';
COMMENT ON FUNCTION get_permisos_adicionales_usuario IS 'SECURITY DEFINER: Usa privilegios del owner para bypass de RLS al obtener permisos';
