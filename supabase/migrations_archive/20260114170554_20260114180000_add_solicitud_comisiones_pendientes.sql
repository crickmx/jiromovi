/*
  # Agregar Trámite de Solicitud de Comisiones Pendientes

  ## Descripción
  Permite a los usuarios crear trámites para reportar comisiones que aún no han sido pagadas.
  Cada trámite puede contener hasta 10 comisiones pendientes.

  ## Cambios
  1. Agregar tipo de trámite 'solicitud_comisiones_pendientes' al enum
  2. Crear tabla `ticket_comisiones_pendientes` para almacenar las comisiones
  3. Configurar RLS para la nueva tabla
  4. Crear índices para optimizar consultas

  ## Nuevas Tablas
    - `ticket_comisiones_pendientes`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key a tickets)
      - `numero_poliza` (text, nullable)
      - `aseguradora` (text, nullable)
      - `fecha_pago` (date, nullable)
      - `orden` (integer) - Orden de entrada
      - `created_at` (timestamp)

  ## Seguridad
    - RLS habilitado siguiendo el patrón de otras tablas de tickets
    - Los usuarios pueden ver comisiones de sus propios tickets
    - Staff puede ver todas las comisiones
*/

-- 1. Agregar nuevo tipo de trámite al CHECK constraint
DO $$
BEGIN
  -- Eliminar constraint existente
  ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tipo_tramite_check;

  -- Crear nuevo constraint con el tipo adicional
  ALTER TABLE tickets ADD CONSTRAINT tickets_tipo_tramite_check
    CHECK (tipo_tramite IN (
      'correccion_poliza_registrada',
      'correccion_comisiones',
      'registro_poliza',
      'solicitud_comisiones_pendientes'
    ));
END $$;

-- 2. Crear tabla de comisiones pendientes
CREATE TABLE IF NOT EXISTS ticket_comisiones_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  numero_poliza text,
  aseguradora text,
  fecha_pago date,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Crear índices
CREATE INDEX IF NOT EXISTS idx_ticket_comisiones_pendientes_ticket
  ON ticket_comisiones_pendientes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comisiones_pendientes_orden
  ON ticket_comisiones_pendientes(ticket_id, orden);

-- 4. Habilitar RLS
ALTER TABLE ticket_comisiones_pendientes ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para ticket_comisiones_pendientes
-- Los usuarios pueden ver comisiones de tickets que pueden ver
CREATE POLICY "Users can view commissions from their tickets"
  ON ticket_comisiones_pendientes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comisiones_pendientes.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR tickets.assigned_to_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador', 'Empleado')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Los usuarios pueden crear comisiones en sus propios tickets
CREATE POLICY "Users can create commissions in their tickets"
  ON ticket_comisiones_pendientes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comisiones_pendientes.ticket_id
      AND (
        tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador', 'Empleado')
        )
      )
    )
  );

-- Staff puede actualizar comisiones
CREATE POLICY "Staff can update commissions"
  ON ticket_comisiones_pendientes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador', 'Empleado')
    )
  );

-- Staff puede eliminar comisiones
CREATE POLICY "Staff can delete commissions"
  ON ticket_comisiones_pendientes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador', 'Empleado')
    )
  );

-- 6. Función para obtener comisiones pendientes de un ticket
CREATE OR REPLACE FUNCTION get_ticket_comisiones_pendientes(p_ticket_id uuid)
RETURNS TABLE (
  id uuid,
  numero_poliza text,
  aseguradora text,
  fecha_pago date,
  orden integer,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tcp.id,
    tcp.numero_poliza,
    tcp.aseguradora,
    tcp.fecha_pago,
    tcp.orden,
    tcp.created_at
  FROM ticket_comisiones_pendientes tcp
  WHERE tcp.ticket_id = p_ticket_id
  ORDER BY tcp.orden ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que usuarios autenticados ejecuten la función
GRANT EXECUTE ON FUNCTION get_ticket_comisiones_pendientes TO authenticated;

-- 7. Comentarios
COMMENT ON TABLE ticket_comisiones_pendientes IS 'Almacena las comisiones pendientes reportadas en cada ticket de solicitud';
COMMENT ON COLUMN ticket_comisiones_pendientes.numero_poliza IS 'Número de póliza de la comisión pendiente (opcional)';
COMMENT ON COLUMN ticket_comisiones_pendientes.aseguradora IS 'Aseguradora de la comisión pendiente (opcional)';
COMMENT ON COLUMN ticket_comisiones_pendientes.fecha_pago IS 'Fecha esperada de pago de la comisión (opcional)';
COMMENT ON COLUMN ticket_comisiones_pendientes.orden IS 'Orden de entrada de la comisión en el ticket';
COMMENT ON FUNCTION get_ticket_comisiones_pendientes IS 'Obtiene todas las comisiones pendientes de un ticket ordenadas por orden de entrada';
