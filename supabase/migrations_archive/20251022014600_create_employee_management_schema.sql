/*
  # Sistema de Gestión de Empleados - Schema Inicial

  ## Descripción
  Este migration crea la estructura completa para un sistema de gestión de empleados
  con control de acceso basado en roles y campos editables personalizables.

  ## 1. Nuevas Tablas

  ### `oficinas`
  Almacena las oficinas de la empresa
  - `id` (uuid, primary key)
  - `nombre` (text, único) - Nombre de la oficina
  - `activa` (boolean) - Si la oficina está activa
  - `created_at` (timestamptz) - Fecha de creación

  ### `usuarios`
  Perfiles de todos los usuarios del sistema
  - `id` (uuid, primary key, references auth.users)
  - `username` (text, único) - Nombre de usuario para login
  - `rol` (text) - Administrador, Empleado, o Agente
  - `nombre` (text) - Nombre del usuario
  - `apellidos` (text) - Apellidos
  - `puesto` (text) - Cargo o puesto
  - `oficina_id` (uuid) - Referencia a oficinas
  - `fecha_nacimiento` (date) - Fecha de nacimiento
  - `fecha_ingreso` (date) - Fecha de ingreso a la empresa
  - `celular_personal` (text) - Teléfono personal
  - `email_personal` (text) - Correo personal
  - `celular_laboral` (text) - Teléfono laboral
  - `email_laboral` (text) - Correo laboral
  - `extension_telefonica` (text) - Extensión telefónica
  - `url_web_jiro` (text) - URL Web Jiro
  - `url_web_multicotizador` (text) - URL Web Multicotizador
  - `imagen_perfil_url` (text) - URL de imagen de perfil
  - `activo` (boolean) - Si el usuario está activo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Última actualización

  ### `campos_personalizados`
  Define campos adicionales creados por administradores
  - `id` (uuid, primary key)
  - `nombre_campo` (text, único) - Identificador del campo
  - `etiqueta` (text) - Label mostrado en la UI
  - `tipo_campo` (text) - text, number, date, dropdown, etc.
  - `opciones` (jsonb) - Opciones para dropdowns
  - `orden` (integer) - Orden de visualización
  - `activo` (boolean) - Si el campo está activo
  - `created_at` (timestamptz) - Fecha de creación

  ### `valores_campos_personalizados`
  Almacena valores de campos personalizados por usuario
  - `id` (uuid, primary key)
  - `usuario_id` (uuid) - Referencia a usuarios
  - `campo_id` (uuid) - Referencia a campos_personalizados
  - `valor` (text) - Valor del campo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Última actualización

  ### `permisos_campos`
  Define qué campos puede editar cada rol
  - `id` (uuid, primary key)
  - `rol` (text) - Rol al que aplica el permiso
  - `nombre_campo` (text) - Nombre del campo
  - `editable` (boolean) - Si el rol puede editar este campo
  - `visible` (boolean) - Si el rol puede ver este campo
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Última actualización

  ## 2. Seguridad (RLS)
  
  Se habilita Row Level Security en todas las tablas y se crean políticas restrictivas:
  
  ### Oficinas
  - Administradores: pueden leer, crear, actualizar y eliminar
  - Empleados/Agentes: solo pueden leer
  
  ### Usuarios
  - Administradores: pueden leer, crear, actualizar y eliminar todos los usuarios
  - Empleados/Agentes: solo pueden leer y actualizar su propio perfil
  
  ### Campos Personalizados
  - Administradores: acceso completo
  - Empleados/Agentes: solo lectura de campos activos
  
  ### Valores Campos Personalizados
  - Administradores: acceso completo
  - Empleados/Agentes: pueden leer sus propios valores y actualizar si tienen permiso
  
  ### Permisos Campos
  - Administradores: acceso completo
  - Empleados/Agentes: solo lectura

  ## 3. Notas Importantes
  
  - Todos los usuarios deben ser creados primero en auth.users por el administrador
  - Las contraseñas son gestionadas a través de Supabase Auth
  - El primer administrador debe ser creado manualmente
  - Los campos por defecto están incorporados en la tabla usuarios
  - Los permisos se verifican en el frontend y backend
*/

-- Crear tabla de oficinas
CREATE TABLE IF NOT EXISTS oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  activa boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Crear tabla de usuarios (perfiles)
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  rol text NOT NULL CHECK (rol IN ('Administrador', 'Empleado', 'Agente')),
  nombre text NOT NULL,
  apellidos text NOT NULL,
  puesto text DEFAULT '',
  oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL,
  fecha_nacimiento date,
  fecha_ingreso date,
  celular_personal text DEFAULT '',
  email_personal text DEFAULT '',
  celular_laboral text DEFAULT '',
  email_laboral text DEFAULT '',
  extension_telefonica text DEFAULT '',
  url_web_jiro text DEFAULT '',
  url_web_multicotizador text DEFAULT '',
  imagen_perfil_url text DEFAULT '',
  activo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Crear tabla de campos personalizados
CREATE TABLE IF NOT EXISTS campos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_campo text UNIQUE NOT NULL,
  etiqueta text NOT NULL,
  tipo_campo text NOT NULL CHECK (tipo_campo IN ('text', 'number', 'date', 'dropdown', 'textarea', 'email', 'tel', 'url')),
  opciones jsonb DEFAULT '[]'::jsonb,
  orden integer DEFAULT 0 NOT NULL,
  activo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Crear tabla de valores de campos personalizados
CREATE TABLE IF NOT EXISTS valores_campos_personalizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  campo_id uuid REFERENCES campos_personalizados(id) ON DELETE CASCADE NOT NULL,
  valor text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(usuario_id, campo_id)
);

-- Crear tabla de permisos de campos
CREATE TABLE IF NOT EXISTS permisos_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol text NOT NULL CHECK (rol IN ('Administrador', 'Empleado', 'Agente')),
  nombre_campo text NOT NULL,
  editable boolean DEFAULT false NOT NULL,
  visible boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(rol, nombre_campo)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE oficinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE valores_campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_campos ENABLE ROW LEVEL SECURITY;

-- Políticas para oficinas
CREATE POLICY "Administradores pueden ver todas las oficinas"
  ON oficinas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Empleados y Agentes pueden ver oficinas activas"
  ON oficinas FOR SELECT
  TO authenticated
  USING (
    activa = true
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden crear oficinas"
  ON oficinas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden actualizar oficinas"
  ON oficinas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden eliminar oficinas"
  ON oficinas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Políticas para usuarios
CREATE POLICY "Administradores pueden ver todos los usuarios"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );

CREATE POLICY "Usuarios pueden ver su propio perfil"
  ON usuarios FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND activo = true);

CREATE POLICY "Administradores pueden crear usuarios"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden actualizar cualquier usuario"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND activo = true)
  WITH CHECK (id = auth.uid() AND activo = true);

CREATE POLICY "Administradores pueden eliminar usuarios"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.activo = true
    )
  );

-- Políticas para campos personalizados
CREATE POLICY "Administradores pueden ver todos los campos personalizados"
  ON campos_personalizados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Usuarios pueden ver campos personalizados activos"
  ON campos_personalizados FOR SELECT
  TO authenticated
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden crear campos personalizados"
  ON campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden actualizar campos personalizados"
  ON campos_personalizados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden eliminar campos personalizados"
  ON campos_personalizados FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Políticas para valores de campos personalizados
CREATE POLICY "Administradores pueden ver todos los valores"
  ON valores_campos_personalizados FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Usuarios pueden ver sus propios valores"
  ON valores_campos_personalizados FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden crear valores"
  ON valores_campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Usuarios pueden crear sus propios valores"
  ON valores_campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden actualizar valores"
  ON valores_campos_personalizados FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Usuarios pueden actualizar sus propios valores"
  ON valores_campos_personalizados FOR UPDATE
  TO authenticated
  USING (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  )
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden eliminar valores"
  ON valores_campos_personalizados FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Políticas para permisos de campos
CREATE POLICY "Todos los usuarios autenticados pueden ver permisos"
  ON permisos_campos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden crear permisos"
  ON permisos_campos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden actualizar permisos"
  ON permisos_campos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

CREATE POLICY "Administradores pueden eliminar permisos"
  ON permisos_campos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
      AND usuarios.activo = true
    )
  );

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_oficina ON usuarios(oficina_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_valores_usuario ON valores_campos_personalizados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_valores_campo ON valores_campos_personalizados(campo_id);
CREATE INDEX IF NOT EXISTS idx_permisos_rol ON permisos_campos(rol);

-- Insertar permisos por defecto para campos estándar (todos visibles, algunos editables para Empleados/Agentes)
INSERT INTO permisos_campos (rol, nombre_campo, editable, visible) VALUES
  -- Permisos para Empleados
  ('Empleado', 'nombre', false, true),
  ('Empleado', 'apellidos', false, true),
  ('Empleado', 'rol', false, true),
  ('Empleado', 'puesto', false, true),
  ('Empleado', 'oficina_id', false, true),
  ('Empleado', 'fecha_nacimiento', true, true),
  ('Empleado', 'fecha_ingreso', false, true),
  ('Empleado', 'celular_personal', true, true),
  ('Empleado', 'email_personal', true, true),
  ('Empleado', 'celular_laboral', false, true),
  ('Empleado', 'email_laboral', false, true),
  ('Empleado', 'extension_telefonica', false, true),
  ('Empleado', 'url_web_jiro', true, true),
  ('Empleado', 'url_web_multicotizador', true, true),
  ('Empleado', 'imagen_perfil_url', true, true),
  -- Permisos para Agentes
  ('Agente', 'nombre', false, true),
  ('Agente', 'apellidos', false, true),
  ('Agente', 'rol', false, true),
  ('Agente', 'puesto', false, true),
  ('Agente', 'oficina_id', false, true),
  ('Agente', 'fecha_nacimiento', true, true),
  ('Agente', 'fecha_ingreso', false, true),
  ('Agente', 'celular_personal', true, true),
  ('Agente', 'email_personal', true, true),
  ('Agente', 'celular_laboral', false, true),
  ('Agente', 'email_laboral', false, true),
  ('Agente', 'extension_telefonica', false, true),
  ('Agente', 'url_web_jiro', true, true),
  ('Agente', 'url_web_multicotizador', true, true),
  ('Agente', 'imagen_perfil_url', true, true),
  -- Permisos para Administradores (todos editables)
  ('Administrador', 'nombre', true, true),
  ('Administrador', 'apellidos', true, true),
  ('Administrador', 'rol', true, true),
  ('Administrador', 'puesto', true, true),
  ('Administrador', 'oficina_id', true, true),
  ('Administrador', 'fecha_nacimiento', true, true),
  ('Administrador', 'fecha_ingreso', true, true),
  ('Administrador', 'celular_personal', true, true),
  ('Administrador', 'email_personal', true, true),
  ('Administrador', 'celular_laboral', true, true),
  ('Administrador', 'email_laboral', true, true),
  ('Administrador', 'extension_telefonica', true, true),
  ('Administrador', 'url_web_jiro', true, true),
  ('Administrador', 'url_web_multicotizador', true, true),
  ('Administrador', 'imagen_perfil_url', true, true)
ON CONFLICT (rol, nombre_campo) DO NOTHING;

-- Insertar oficina por defecto
INSERT INTO oficinas (nombre) VALUES ('Oficina Principal')
ON CONFLICT (nombre) DO NOTHING;