/*
  # Corregir Recursión Infinita en Políticas RLS de Tickets
  
  1. Problema
    - Las políticas de tickets consultan la tabla usuarios
    - Las políticas de usuarios pueden causar recursión
    
  2. Solución
    - Usar auth.uid() directamente sin subconsultas complejas
    - Crear función segura que no cause recursión
    - Simplificar políticas usando user_roles o auth.jwt()
*/

-- Eliminar políticas existentes problemáticas
DROP POLICY IF EXISTS "Agentes pueden ver sus tickets" ON tickets;
DROP POLICY IF EXISTS "Ejecutivos y superiores pueden actualizar tickets" ON tickets;
DROP POLICY IF EXISTS "Solo admin puede eliminar tickets" ON tickets;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tickets" ON tickets;

-- Crear función segura para verificar rol sin recursión
CREATE OR REPLACE FUNCTION obtener_rol_usuario()
RETURNS text AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Política de SELECT simplificada sin recursión
CREATE POLICY "Ver tickets propios o asignados"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    agente_id = auth.uid() OR
    creado_por = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

-- Política de INSERT simplificada
CREATE POLICY "Crear tickets propios"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

-- Política de UPDATE simplificada
CREATE POLICY "Actualizar tickets asignados o superior"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

-- Política de DELETE solo para admin
CREATE POLICY "Eliminar tickets solo admin"
  ON tickets FOR DELETE
  TO authenticated
  USING (obtener_rol_usuario() = 'Administrador');

-- Verificar y corregir políticas de usuarios si causan recursión
DO $$ 
BEGIN
  -- Eliminar políticas problemáticas de usuarios si existen
  DROP POLICY IF EXISTS "Usuarios pueden ver perfiles según rol" ON usuarios;
  DROP POLICY IF EXISTS "Gerentes pueden ver usuarios de su oficina" ON usuarios;
  
  -- Crear política simple sin recursión para usuarios
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usuarios' AND policyname = 'Ver usuarios autenticados') THEN
    CREATE POLICY "Ver usuarios autenticados"
      ON usuarios FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usuarios' AND policyname = 'Actualizar perfil propio') THEN
    CREATE POLICY "Actualizar perfil propio"
      ON usuarios FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Corregir políticas de ticket_asignaciones para evitar recursión
DROP POLICY IF EXISTS "Ver asignaciones de tickets accesibles" ON ticket_asignaciones;

CREATE POLICY "Ver asignaciones propias o rol superior"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    ejecutivo_id = auth.uid() OR
    asignado_por = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

-- Corregir políticas de ticket_comentarios
DROP POLICY IF EXISTS "Ver comentarios de tickets accesibles" ON ticket_comentarios;

CREATE POLICY "Ver comentarios de tickets"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_comentarios.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Corregir políticas de ticket_historial
DROP POLICY IF EXISTS "Ver historial de tickets accesibles" ON ticket_historial;

CREATE POLICY "Ver historial de tickets"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_historial.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Corregir políticas de ticket_archivos
DROP POLICY IF EXISTS "Ver archivos de tickets accesibles" ON ticket_archivos;

CREATE POLICY "Ver archivos de tickets"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_archivos.ticket_id
      AND (
        t.agente_id = auth.uid() OR
        t.creado_por = auth.uid() OR
        EXISTS (
          SELECT 1 FROM ticket_asignaciones ta
          WHERE ta.ticket_id = t.id
          AND ta.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Agregar políticas de INSERT/UPDATE/DELETE para ticket_comentarios
CREATE POLICY "Crear comentarios en tickets accesibles"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    (
      obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
      EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_comentarios.ticket_id
        AND (
          t.agente_id = auth.uid() OR
          t.creado_por = auth.uid() OR
          EXISTS (
            SELECT 1 FROM ticket_asignaciones ta
            WHERE ta.ticket_id = t.id
            AND ta.ejecutivo_id = auth.uid()
          )
        )
      )
    )
  );

-- Agregar políticas para ticket_asignaciones INSERT
CREATE POLICY "Asignar tickets si es admin o gerente"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    asignado_por = auth.uid() AND
    obtener_rol_usuario() IN ('Gerente', 'Administrador')
  );

-- Agregar políticas para ticket_archivos INSERT
CREATE POLICY "Subir archivos a tickets accesibles"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid() AND
    (
      obtener_rol_usuario() IN ('Gerente', 'Administrador') OR
      EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.id = ticket_archivos.ticket_id
        AND (
          t.agente_id = auth.uid() OR
          t.creado_por = auth.uid() OR
          EXISTS (
            SELECT 1 FROM ticket_asignaciones ta
            WHERE ta.ticket_id = t.id
            AND ta.ejecutivo_id = auth.uid()
          )
        )
      )
    )
  );

-- Comentarios
COMMENT ON FUNCTION obtener_rol_usuario() IS 'Función segura para obtener rol del usuario actual sin causar recursión en RLS';
