/*
  # Extender Tickets para 3 Tipos y Notificaciones Campanita
  
  ## Descripción
  Amplía el sistema de tickets/trámites para soportar:
  1. Corrección de póliza registrada (existente)
  2. Corrección de comisiones (nuevo)
  3. Registro de póliza (nuevo)
  
  ## Cambios
  1. Agregar tipo_tramite (enum)
  2. Agregar assigned_to_user_id (asignado directo)
  3. Agregar campos específicos para corrección de comisiones
  4. Agregar campos específicos para registro de póliza
  5. Agregar tracking de actualizaciones para notificaciones
  6. Crear catálogo de aseguradoras desde producción
  
  ## Seguridad
  - RLS actualizado para permisos por rol y asignación
*/

-- 1. Crear catálogo de aseguradoras desde producción
CREATE TABLE IF NOT EXISTS cat_aseguradoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Poblar catálogo desde production_records (eliminar duplicados)
INSERT INTO cat_aseguradoras (nombre)
SELECT DISTINCT TRIM(aseguradora_nombre) as nombre
FROM production_records
WHERE aseguradora_nombre IS NOT NULL 
  AND TRIM(aseguradora_nombre) != ''
ON CONFLICT (nombre) DO NOTHING;

-- Agregar algunas comunes si no existen
INSERT INTO cat_aseguradoras (nombre) VALUES
  ('AXA'),
  ('GNP'),
  ('Qualitas'),
  ('Mapfre'),
  ('HDI')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Extender tickets con nuevos campos
DO $$
BEGIN
  -- Tipo de trámite
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'tipo_tramite'
  ) THEN
    ALTER TABLE tickets ADD COLUMN tipo_tramite text NOT NULL DEFAULT 'correccion_poliza_registrada'
      CHECK (tipo_tramite IN ('correccion_poliza_registrada', 'correccion_comisiones', 'registro_poliza'));
  END IF;
  
  -- Asignado directo (complementa ticket_asignaciones)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'assigned_to_user_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN assigned_to_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
  
  -- Campos para CORRECCIÓN DE COMISIONES
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'comisiones_lote_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN comisiones_lote_id uuid REFERENCES commission_batches(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'comisiones_lote_label'
  ) THEN
    ALTER TABLE tickets ADD COLUMN comisiones_lote_label text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'comisiones_documento_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN comisiones_documento_id uuid REFERENCES commission_details(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'comisiones_poliza_ref'
  ) THEN
    ALTER TABLE tickets ADD COLUMN comisiones_poliza_ref text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'comisiones_context_snapshot'
  ) THEN
    ALTER TABLE tickets ADD COLUMN comisiones_context_snapshot jsonb DEFAULT '{}'::jsonb;
  END IF;
  
  -- Campos para REGISTRO DE PÓLIZA
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_aseguradora'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_aseguradora text REFERENCES cat_aseguradoras(nombre);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_clave_agente'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_clave_agente text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_numero_poliza'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_numero_poliza text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_cliente'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_cliente text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_vigencia_inicio'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_vigencia_inicio date;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'registro_vigencia_fin'
  ) THEN
    ALTER TABLE tickets ADD COLUMN registro_vigencia_fin date;
  END IF;
  
  -- Tracking de cambios para notificaciones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'previous_status_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN previous_status_id uuid;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'previous_assigned_to'
  ) THEN
    ALTER TABLE tickets ADD COLUMN previous_assigned_to uuid;
  END IF;
END $$;

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_tickets_tipo_tramite ON tickets(tipo_tramite);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_lote ON tickets(comisiones_lote_id);
CREATE INDEX IF NOT EXISTS idx_tickets_comisiones_documento ON tickets(comisiones_documento_id);

-- 4. Trigger para notificaciones campanita en cambios
CREATE OR REPLACE FUNCTION notify_ticket_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title text;
  v_notification_body text;
  v_notification_url text;
  v_target_user_id uuid;
  v_changed_by_name text;
  v_status_changed boolean := false;
  v_reassigned boolean := false;
BEGIN
  -- Obtener nombre del usuario que hace el cambio
  SELECT nombre_completo INTO v_changed_by_name
  FROM usuarios
  WHERE id = NEW.modificado_por;
  
  v_changed_by_name := COALESCE(v_changed_by_name, 'Sistema');
  
  -- URL para el detalle del ticket
  v_notification_url := '/tramites/' || NEW.id;
  
  -- Detectar tipo de cambio
  IF TG_OP = 'UPDATE' THEN
    -- Cambio de estatus
    IF OLD.estatus_id IS DISTINCT FROM NEW.estatus_id THEN
      v_status_changed := true;
      v_notification_title := 'Actualización de trámite';
      
      DECLARE
        v_new_status_name text;
      BEGIN
        SELECT nombre INTO v_new_status_name
        FROM ticket_estatus
        WHERE id = NEW.estatus_id;
        
        v_notification_body := format('Tu trámite %s cambió a estatus: %s', NEW.folio, v_new_status_name);
      END;
    END IF;
    
    -- Reasignación
    IF OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id THEN
      v_reassigned := true;
      v_notification_title := 'Trámite asignado';
      v_notification_body := format('Se te asignó el trámite %s', NEW.folio);
      
      -- Notificar al nuevo asignado
      IF NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id != NEW.modificado_por THEN
        INSERT INTO notifications (
          user_id,
          title,
          body,
          link_url,
          is_read
        ) VALUES (
          NEW.assigned_to_user_id,
          v_notification_title,
          v_notification_body,
          v_notification_url,
          false
        );
      END IF;
      
      -- Notificar al anterior asignado
      IF OLD.assigned_to_user_id IS NOT NULL AND OLD.assigned_to_user_id != NEW.modificado_por THEN
        INSERT INTO notifications (
          user_id,
          title,
          body,
          link_url,
          is_read
        ) VALUES (
          OLD.assigned_to_user_id,
          'Trámite reasignado',
          format('El trámite %s fue reasignado a otro usuario', NEW.folio),
          v_notification_url,
          false
        );
      END IF;
    END IF;
    
    -- Cambio de datos generales (sin reasignación ni cambio de estatus)
    IF NOT v_status_changed AND NOT v_reassigned THEN
      v_notification_title := 'Tu trámite fue actualizado';
      v_notification_body := format('Tu trámite %s fue actualizado por %s', NEW.folio, v_changed_by_name);
    END IF;
    
    -- Determinar destinatario
    v_target_user_id := NEW.assigned_to_user_id;
    
    -- Solo notificar si el que hace el cambio NO es el asignado (evitar auto-notificaciones)
    IF v_target_user_id IS NOT NULL AND v_target_user_id != NEW.modificado_por AND (v_status_changed OR (NOT v_reassigned)) THEN
      INSERT INTO notifications (
        user_id,
        title,
        body,
        link_url,
        is_read
      ) VALUES (
        v_target_user_id,
        v_notification_title,
        v_notification_body,
        v_notification_url,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_ticket_changes ON tickets;
CREATE TRIGGER trigger_notify_ticket_changes
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_changes();

-- 5. Actualizar RLS policies para incluir assigned_to_user_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view related tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Users can update tickets" ON tickets;
DROP POLICY IF EXISTS "Agents can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Staff can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Agents can update own tickets" ON tickets;
DROP POLICY IF EXISTS "Staff can update all tickets" ON tickets;

-- Agentes pueden ver tickets donde son creador o asignado
CREATE POLICY "Agents can view own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Agente'
      AND (
        tickets.creado_por = auth.uid()
        OR tickets.assigned_to_user_id = auth.uid()
        OR tickets.agente_id = auth.uid()
      )
    )
  );

-- Empleados/Gerentes/Admins pueden ver todos
CREATE POLICY "Staff can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Empleado', 'Gerente', 'Administrador')
    )
  );

-- Todos los autenticados pueden crear tickets
CREATE POLICY "Authenticated users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Agentes solo pueden actualizar sus propios tickets
CREATE POLICY "Agents can update own tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Agente'
      AND (
        tickets.creado_por = auth.uid()
        OR tickets.assigned_to_user_id = auth.uid()
      )
    )
  );

-- Staff puede actualizar cualquier ticket
CREATE POLICY "Staff can update all tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Empleado', 'Gerente', 'Administrador')
    )
  );

-- 6. Función helper para obtener lotes disponibles para corrección
CREATE OR REPLACE FUNCTION get_available_commission_batches_for_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  date_from date,
  date_to date,
  status text,
  documents_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cb.id,
    cb.name,
    cb.date_from,
    cb.date_to,
    cb.status,
    COUNT(cd.id) as documents_count
  FROM commission_batches cb
  LEFT JOIN commission_details cd ON cd.batch_id = cb.id
  WHERE cb.status != 'cancelled'
  AND (
    -- Si es agente, solo sus lotes
    (SELECT rol FROM usuarios WHERE id = p_user_id) = 'Agente'
    AND EXISTS (
      SELECT 1 FROM commission_details cd2
      JOIN commission_agents ca ON ca.id = cd2.agent_id
      WHERE cd2.batch_id = cb.id
      AND ca.usuario_id = p_user_id
    )
    OR
    -- Si es staff, todos los lotes
    (SELECT rol FROM usuarios WHERE id = p_user_id) IN ('Empleado', 'Gerente', 'Administrador')
  )
  GROUP BY cb.id, cb.name, cb.date_from, cb.date_to, cb.status
  ORDER BY cb.date_from DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función helper para obtener documentos de un lote
CREATE OR REPLACE FUNCTION get_commission_documents_for_batch(p_batch_id uuid)
RETURNS TABLE (
  id uuid,
  poliza text,
  nombre_asegurado text,
  aseguradora text,
  importe_base float,
  prima_neta float,
  date_fpago date,
  concepto text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.id,
    cd.poliza,
    cd.nombre_asegurado,
    cd.aseguradora,
    cd.importe_base,
    cd.prima_neta,
    cd.date_fpago,
    cd.concepto
  FROM commission_details cd
  WHERE cd.batch_id = p_batch_id
  ORDER BY cd.date_fpago DESC, cd.poliza;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Migrar datos existentes
-- Establecer tipo_tramite para tickets existentes
UPDATE tickets
SET tipo_tramite = 'correccion_poliza_registrada'
WHERE tipo_tramite IS NULL;

-- Establecer assigned_to_user_id desde agente_id para tickets existentes
UPDATE tickets
SET assigned_to_user_id = agente_id
WHERE assigned_to_user_id IS NULL AND agente_id IS NOT NULL;

-- 9. Enable RLS on cat_aseguradoras
ALTER TABLE cat_aseguradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view aseguradoras"
  ON cat_aseguradoras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage aseguradoras"
  ON cat_aseguradoras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Comentarios
COMMENT ON TABLE cat_aseguradoras IS 'Catálogo de aseguradoras para registro de pólizas';
COMMENT ON COLUMN tickets.tipo_tramite IS 'Tipo de trámite: corrección de póliza, corrección de comisiones, o registro de póliza';
COMMENT ON COLUMN tickets.assigned_to_user_id IS 'Usuario asignado directo (complementa ticket_asignaciones)';
COMMENT ON FUNCTION get_available_commission_batches_for_user IS 'Obtiene lotes de comisiones disponibles para corrección según rol del usuario';
COMMENT ON FUNCTION get_commission_documents_for_batch IS 'Obtiene documentos de un lote de comisiones para selección en ticket de corrección';