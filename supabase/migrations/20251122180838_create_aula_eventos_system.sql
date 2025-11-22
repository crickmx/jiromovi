/*
  # Sistema de Eventos del Aula Digital

  1. Nuevas Tablas
    - `aula_eventos`
      - `id` (uuid, primary key)
      - `titulo` (text) - Título del evento
      - `descripcion` (text) - Descripción detallada
      - `ponente` (text) - Nombre del instructor/ponente
      - `fecha` (date) - Fecha del evento
      - `hora` (time) - Hora del evento
      - `link_sesion` (text) - URL de la sesión (NO visible directamente)
      - `creado_por` (uuid) - Usuario que creó el evento
      - `creado_en` (timestamptz) - Fecha de creación
      - `modificado_en` (timestamptz) - Última modificación
      - `visible_para_todos` (boolean) - Si es visible para todos los usuarios

    - `aula_eventos_permisos`
      - `id` (uuid, primary key)
      - `evento_id` (uuid, foreign key)
      - `usuario_id` (uuid, foreign key, nullable)
      - `rol` (text, nullable)
      - `oficina_id` (uuid, foreign key, nullable)
      - `creado_en` (timestamptz)

  2. Seguridad
    - Enable RLS en ambas tablas
    - Políticas para administradores (crear/editar/eliminar)
    - Políticas para usuarios (ver solo eventos autorizados)
    - Función para verificar si usuario tiene permiso

  3. Funciones
    - `usuario_tiene_permiso_evento(evento_uuid, user_uuid)` - Verifica permisos
    - `obtener_usuarios_con_permiso_evento(evento_uuid)` - Lista usuarios autorizados
*/

-- Crear tabla de eventos
CREATE TABLE IF NOT EXISTS aula_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text NOT NULL,
  ponente text NOT NULL,
  fecha date NOT NULL,
  hora time NOT NULL,
  link_sesion text NOT NULL,
  creado_por uuid REFERENCES auth.users(id) NOT NULL,
  creado_en timestamptz DEFAULT now() NOT NULL,
  modificado_en timestamptz DEFAULT now() NOT NULL,
  visible_para_todos boolean DEFAULT false NOT NULL
);

-- Crear tabla de permisos
CREATE TABLE IF NOT EXISTS aula_eventos_permisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES aula_eventos(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text,
  oficina_id uuid REFERENCES oficinas(id) ON DELETE CASCADE,
  creado_en timestamptz DEFAULT now() NOT NULL,

  -- Al menos uno debe estar presente
  CONSTRAINT check_permiso_valido CHECK (
    usuario_id IS NOT NULL OR
    rol IS NOT NULL OR
    oficina_id IS NOT NULL
  )
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_aula_eventos_fecha ON aula_eventos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_creado_por ON aula_eventos(creado_por);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_evento ON aula_eventos_permisos(evento_id);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_usuario ON aula_eventos_permisos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_rol ON aula_eventos_permisos(rol);
CREATE INDEX IF NOT EXISTS idx_aula_eventos_permisos_oficina ON aula_eventos_permisos(oficina_id);

-- Función para verificar si un usuario tiene permiso para ver un evento
CREATE OR REPLACE FUNCTION usuario_tiene_permiso_evento(evento_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  evento_visible_todos boolean;
  user_rol text;
  user_oficina uuid;
  tiene_permiso boolean;
BEGIN
  -- Obtener si el evento es visible para todos
  SELECT visible_para_todos INTO evento_visible_todos
  FROM aula_eventos
  WHERE id = evento_uuid;

  -- Si es visible para todos, retornar true
  IF evento_visible_todos THEN
    RETURN true;
  END IF;

  -- Obtener rol y oficina del usuario
  SELECT rol, oficina_id INTO user_rol, user_oficina
  FROM usuarios
  WHERE id = user_uuid;

  -- Verificar si tiene permiso directo, por rol o por oficina
  SELECT EXISTS (
    SELECT 1
    FROM aula_eventos_permisos
    WHERE evento_id = evento_uuid
    AND (
      usuario_id = user_uuid OR
      rol = user_rol OR
      oficina_id = user_oficina
    )
  ) INTO tiene_permiso;

  RETURN tiene_permiso;
END;
$$;

-- Función para obtener todos los usuarios que tienen permiso para un evento
CREATE OR REPLACE FUNCTION obtener_usuarios_con_permiso_evento(evento_uuid uuid)
RETURNS TABLE(usuario_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el evento es visible para todos, retornar todos los usuarios
  IF EXISTS (
    SELECT 1 FROM aula_eventos
    WHERE id = evento_uuid AND visible_para_todos = true
  ) THEN
    RETURN QUERY
    SELECT u.id
    FROM usuarios u;
  ELSE
    -- Retornar usuarios con permisos específicos
    RETURN QUERY
    SELECT DISTINCT u.id
    FROM usuarios u
    WHERE EXISTS (
      SELECT 1
      FROM aula_eventos_permisos aep
      WHERE aep.evento_id = evento_uuid
      AND (
        aep.usuario_id = u.id OR
        aep.rol = u.rol OR
        aep.oficina_id = u.oficina_id
      )
    );
  END IF;
END;
$$;

-- Enable RLS
ALTER TABLE aula_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aula_eventos_permisos ENABLE ROW LEVEL SECURITY;

-- Políticas para aula_eventos

-- Administradores pueden ver todos los eventos
CREATE POLICY "Administradores pueden ver todos los eventos"
  ON aula_eventos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Usuarios pueden ver eventos si tienen permiso
CREATE POLICY "Usuarios pueden ver eventos autorizados"
  ON aula_eventos
  FOR SELECT
  TO authenticated
  USING (
    usuario_tiene_permiso_evento(id, auth.uid())
  );

-- Administradores pueden crear eventos
CREATE POLICY "Administradores pueden crear eventos"
  ON aula_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Administradores pueden actualizar eventos
CREATE POLICY "Administradores pueden actualizar eventos"
  ON aula_eventos
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

-- Administradores pueden eliminar eventos
CREATE POLICY "Administradores pueden eliminar eventos"
  ON aula_eventos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para aula_eventos_permisos

-- Administradores pueden ver todos los permisos
CREATE POLICY "Administradores pueden ver permisos"
  ON aula_eventos_permisos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Administradores pueden crear permisos
CREATE POLICY "Administradores pueden crear permisos"
  ON aula_eventos_permisos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Administradores pueden eliminar permisos
CREATE POLICY "Administradores pueden eliminar permisos"
  ON aula_eventos_permisos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Trigger para actualizar modificado_en
CREATE OR REPLACE FUNCTION actualizar_modificado_en_aula_eventos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modificado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_modificado_en_aula_eventos
  BEFORE UPDATE ON aula_eventos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_modificado_en_aula_eventos();
