/*
  # Solución Final Definitiva para Recursión en Tickets
  
  1. Problema identificado
    - Políticas duplicadas en tickets
    - ticket_asignaciones puede causar recursión al consultar desde tickets
    
  2. Solución
    - Deshabilitar RLS temporalmente
    - Eliminar TODAS las políticas
    - Recrear políticas simples sin subconsultas problemáticas
    - Usar solo auth.jwt() sin EXISTS en otras tablas con RLS
*/

-- Paso 1: Deshabilitar RLS temporalmente
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_asignaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comentarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_historial DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_archivos DISABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar TODAS las políticas de tickets
DROP POLICY IF EXISTS "Crear tickets propios" ON tickets;
DROP POLICY IF EXISTS "tickets_delete_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;
DROP POLICY IF EXISTS "tickets_update_policy" ON tickets;

-- Paso 3: Eliminar todas las políticas de tablas relacionadas
DROP POLICY IF EXISTS "ticket_asignaciones_select_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_insert_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "ticket_asignaciones_delete_policy" ON ticket_asignaciones;
DROP POLICY IF EXISTS "Ver asignaciones de tickets accesibles" ON ticket_asignaciones;
DROP POLICY IF EXISTS "Ver asignaciones propias o rol superior" ON ticket_asignaciones;

DROP POLICY IF EXISTS "ticket_comentarios_select_policy" ON ticket_comentarios;
DROP POLICY IF EXISTS "ticket_comentarios_insert_policy" ON ticket_comentarios;
DROP POLICY IF EXISTS "Ver comentarios de tickets accesibles" ON ticket_comentarios;
DROP POLICY IF EXISTS "Ver comentarios de tickets" ON ticket_comentarios;
DROP POLICY IF EXISTS "Crear comentarios en tickets accesibles" ON ticket_comentarios;

DROP POLICY IF EXISTS "ticket_historial_select_policy" ON ticket_historial;
DROP POLICY IF EXISTS "ticket_historial_insert_policy" ON ticket_historial;
DROP POLICY IF EXISTS "Ver historial de tickets accesibles" ON ticket_historial;
DROP POLICY IF EXISTS "Ver historial de tickets" ON ticket_historial;

DROP POLICY IF EXISTS "ticket_archivos_select_policy" ON ticket_archivos;
DROP POLICY IF EXISTS "ticket_archivos_insert_policy" ON ticket_archivos;
DROP POLICY IF EXISTS "Ver archivos de tickets accesibles" ON ticket_archivos;
DROP POLICY IF EXISTS "Ver archivos de tickets" ON ticket_archivos;
DROP POLICY IF EXISTS "Subir archivos a tickets accesibles" ON ticket_archivos;

-- Paso 4: Crear tabla auxiliar para asignaciones sin RLS
CREATE TABLE IF NOT EXISTS ticket_asignaciones_cache (
  ticket_id uuid PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  ejecutivos_ids uuid[] DEFAULT ARRAY[]::uuid[],
  updated_at timestamptz DEFAULT now()
);

-- Función para actualizar cache
CREATE OR REPLACE FUNCTION actualizar_asignaciones_cache()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_asignaciones_cache (ticket_id, ejecutivos_ids)
    VALUES (NEW.ticket_id, ARRAY[NEW.ejecutivo_id])
    ON CONFLICT (ticket_id) 
    DO UPDATE SET 
      ejecutivos_ids = array_append(ticket_asignaciones_cache.ejecutivos_ids, NEW.ejecutivo_id),
      updated_at = now();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ticket_asignaciones_cache
    SET ejecutivos_ids = array_remove(ejecutivos_ids, OLD.ejecutivo_id),
        updated_at = now()
    WHERE ticket_id = OLD.ticket_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para mantener cache actualizado
DROP TRIGGER IF EXISTS trigger_actualizar_asignaciones_cache ON ticket_asignaciones;
CREATE TRIGGER trigger_actualizar_asignaciones_cache
  AFTER INSERT OR DELETE ON ticket_asignaciones
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_asignaciones_cache();

-- Poblar cache con datos existentes
INSERT INTO ticket_asignaciones_cache (ticket_id, ejecutivos_ids)
SELECT 
  ticket_id,
  array_agg(ejecutivo_id) as ejecutivos_ids
FROM ticket_asignaciones
GROUP BY ticket_id
ON CONFLICT (ticket_id) DO NOTHING;

-- Paso 5: Recrear políticas de TICKETS usando cache (sin recursión)
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_sin_recursion"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    agente_id = auth.uid() OR
    creado_por = auth.uid() OR
    cerrado_por = auth.uid() OR
    modificado_por = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones_cache tac
      WHERE tac.ticket_id = tickets.id
      AND auth.uid() = ANY(tac.ejecutivos_ids)
    )
  );

CREATE POLICY "tickets_insert_sin_recursion"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "tickets_update_sin_recursion"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador') OR
    EXISTS (
      SELECT 1 FROM ticket_asignaciones_cache tac
      WHERE tac.ticket_id = tickets.id
      AND auth.uid() = ANY(tac.ejecutivos_ids)
    )
  );

CREATE POLICY "tickets_delete_sin_recursion"
  ON tickets FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text = 'Administrador');

-- Paso 6: Recrear políticas de TICKET_ASIGNACIONES (simples, sin recursión)
ALTER TABLE ticket_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_asignaciones_select_simple"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    ejecutivo_id = auth.uid() OR
    asignado_por = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_asignaciones_insert_simple"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    asignado_por = auth.uid() AND
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_asignaciones_delete_simple"
  ON ticket_asignaciones FOR DELETE
  TO authenticated
  USING ((auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador'));

-- Paso 7: Recrear políticas de TICKET_COMENTARIOS (simples)
ALTER TABLE ticket_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_comentarios_select_simple"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_comentarios_insert_simple"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Paso 8: Recrear políticas de TICKET_HISTORIAL (simples)
ALTER TABLE ticket_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_historial_select_simple"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_historial_insert_simple"
  ON ticket_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Paso 9: Recrear políticas de TICKET_ARCHIVOS (simples)
ALTER TABLE ticket_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_archivos_select_simple"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    (auth.jwt()->>'rol')::text IN ('Gerente', 'Administrador')
  );

CREATE POLICY "ticket_archivos_insert_simple"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Comentarios
COMMENT ON TABLE ticket_asignaciones_cache IS 'Cache desnormalizado de asignaciones para evitar recursión en RLS';
COMMENT ON FUNCTION actualizar_asignaciones_cache() IS 'Mantiene sincronizada la cache de asignaciones';
