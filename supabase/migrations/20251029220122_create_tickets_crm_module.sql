/*
  # Módulo CRM de Tickets - Sistema Completo de Gestión de Solicitudes

  1. Nuevas Tablas
    - `ticket_estatus`
      - `id` (uuid, primary key)
      - `nombre` (text) - Nombre del estatus
      - `color` (text) - Color hex para visualización
      - `orden` (integer) - Orden de visualización
      - `activo` (boolean) - Si está activo
      - `created_at` (timestamp)

    - `tickets`
      - `id` (uuid, primary key)
      - `folio` (text, unique) - Código único de 6 caracteres (ej. TK4A92F)
      - `agente_id` (uuid, foreign key) - Usuario agente que solicita
      - `estatus_id` (uuid, foreign key) - Estado actual del ticket
      - `prioridad` (text) - Alta / Media / Baja
      - `poliza` (text) - Número de póliza
      - `instrucciones` (text) - Descripción del ticket
      - `creado_por` (uuid, foreign key) - Usuario que creó el ticket
      - `fecha_creacion` (timestamp)
      - `ultima_modificacion` (timestamp)
      - `modificado_por` (uuid, foreign key)
      - `cerrado_en` (timestamp) - Fecha de cierre
      - `cerrado_por` (uuid, foreign key)

    - `ticket_asignaciones`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key)
      - `ejecutivo_id` (uuid, foreign key)
      - `asignado_en` (timestamp)
      - `asignado_por` (uuid, foreign key)

    - `ticket_comentarios`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key)
      - `usuario_id` (uuid, foreign key)
      - `mensaje` (text)
      - `fecha_hora` (timestamp)

    - `ticket_archivos`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key)
      - `usuario_id` (uuid, foreign key)
      - `nombre` (text)
      - `url` (text)
      - `tipo` (text)
      - `tamano` (bigint)
      - `fecha_subida` (timestamp)

    - `ticket_historial`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key)
      - `usuario_id` (uuid, foreign key)
      - `accion` (text) - Tipo de acción realizada
      - `detalle` (jsonb) - Detalles de la acción
      - `fecha_hora` (timestamp)

  2. Storage Buckets
    - `ticket-archivos` - Para archivos adjuntos de tickets

  3. Seguridad
    - RLS habilitado en todas las tablas
    - Agentes pueden ver solo sus tickets
    - Ejecutivos de Tickets pueden ver tickets asignados
    - Gerentes y Administradores tienen acceso completo
*/

-- Crear tabla de estatus
CREATE TABLE IF NOT EXISTS ticket_estatus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3b82f6',
  orden integer NOT NULL DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla principal de tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text NOT NULL UNIQUE,
  agente_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  estatus_id uuid REFERENCES ticket_estatus(id) ON DELETE SET NULL NOT NULL,
  prioridad text NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  poliza text,
  instrucciones text NOT NULL,
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL NOT NULL,
  fecha_creacion timestamptz DEFAULT now(),
  ultima_modificacion timestamptz DEFAULT now(),
  modificado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  cerrado_en timestamptz,
  cerrado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Crear tabla de asignaciones
CREATE TABLE IF NOT EXISTS ticket_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  ejecutivo_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  asignado_en timestamptz DEFAULT now(),
  asignado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE(ticket_id, ejecutivo_id)
);

-- Crear tabla de comentarios
CREATE TABLE IF NOT EXISTS ticket_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL NOT NULL,
  mensaje text NOT NULL,
  fecha_hora timestamptz DEFAULT now()
);

-- Crear tabla de archivos
CREATE TABLE IF NOT EXISTS ticket_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL NOT NULL,
  nombre text NOT NULL,
  url text NOT NULL,
  tipo text,
  tamano bigint,
  fecha_subida timestamptz DEFAULT now()
);

-- Crear tabla de historial
CREATE TABLE IF NOT EXISTS ticket_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion text NOT NULL,
  detalle jsonb DEFAULT '{}'::jsonb,
  fecha_hora timestamptz DEFAULT now()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_tickets_folio ON tickets(folio);
CREATE INDEX IF NOT EXISTS idx_tickets_agente ON tickets(agente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estatus ON tickets(estatus_id);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridad ON tickets(prioridad);
CREATE INDEX IF NOT EXISTS idx_tickets_poliza ON tickets(poliza);
CREATE INDEX IF NOT EXISTS idx_tickets_creado_por ON tickets(creado_por);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha_creacion ON tickets(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ticket ON ticket_asignaciones(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_asignaciones_ejecutivo ON ticket_asignaciones(ejecutivo_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_ticket ON ticket_comentarios(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comentarios_fecha ON ticket_comentarios(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_archivos_ticket ON ticket_archivos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_historial_ticket ON ticket_historial(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_historial_fecha ON ticket_historial(fecha_hora DESC);

-- Habilitar RLS
ALTER TABLE ticket_estatus ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_historial ENABLE ROW LEVEL SECURITY;

-- Políticas para ticket_estatus
CREATE POLICY "Todos pueden ver estatus activos"
  ON ticket_estatus FOR SELECT
  TO authenticated
  USING (activo = true);

CREATE POLICY "Solo admin puede gestionar estatus"
  ON ticket_estatus FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para tickets
CREATE POLICY "Agentes pueden ver sus tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    agente_id = auth.uid()
    OR creado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador')
    )
    OR EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios autenticados pueden crear tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Ejecutivos y superiores pueden actualizar tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador')
    )
    OR EXISTS (
      SELECT 1 FROM ticket_asignaciones
      WHERE ticket_asignaciones.ticket_id = tickets.id
      AND ticket_asignaciones.ejecutivo_id = auth.uid()
    )
  );

CREATE POLICY "Solo admin puede eliminar tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'Administrador'
    )
  );

-- Políticas para asignaciones
CREATE POLICY "Usuarios pueden ver asignaciones de sus tickets"
  ON ticket_asignaciones FOR SELECT
  TO authenticated
  USING (
    ejecutivo_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_asignaciones.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
      )
    )
  );

CREATE POLICY "Ejecutivos y superiores pueden crear asignaciones"
  ON ticket_asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador')
    )
    OR EXISTS (
      SELECT 1 FROM ticket_asignaciones ta2
      WHERE ta2.ticket_id = ticket_asignaciones.ticket_id
      AND ta2.ejecutivo_id = auth.uid()
    )
  );

CREATE POLICY "Ejecutivos y superiores pueden eliminar asignaciones"
  ON ticket_asignaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Gerente', 'Administrador')
    )
  );

-- Políticas para comentarios
CREATE POLICY "Usuarios pueden ver comentarios de sus tickets"
  ON ticket_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comentarios.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Usuarios pueden crear comentarios en sus tickets"
  ON ticket_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comentarios.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Políticas para archivos (igual que comentarios)
CREATE POLICY "Usuarios pueden ver archivos de sus tickets"
  ON ticket_archivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_archivos.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Usuarios pueden subir archivos a sus tickets"
  ON ticket_archivos FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_archivos.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

-- Políticas para historial (igual que comentarios para lectura)
CREATE POLICY "Usuarios pueden ver historial de sus tickets"
  ON ticket_historial FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_historial.ticket_id
      AND (
        tickets.agente_id = auth.uid()
        OR tickets.creado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM usuarios
          WHERE usuarios.id = auth.uid()
          AND usuarios.rol IN ('Gerente', 'Administrador')
        )
        OR EXISTS (
          SELECT 1 FROM ticket_asignaciones
          WHERE ticket_asignaciones.ticket_id = tickets.id
          AND ticket_asignaciones.ejecutivo_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Sistema puede crear historial"
  ON ticket_historial FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Crear bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-archivos', 'ticket-archivos', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Usuarios pueden subir archivos de tickets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-archivos');

CREATE POLICY "Usuarios pueden ver archivos de tickets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ticket-archivos');

-- Insertar estatus por defecto
INSERT INTO ticket_estatus (nombre, color, orden) VALUES
  ('Nuevo', '#3b82f6', 1),
  ('En proceso', '#f59e0b', 2),
  ('En espera', '#8b5cf6', 3),
  ('Resuelto', '#10b981', 4),
  ('Cerrado', '#6b7280', 5)
ON CONFLICT (nombre) DO NOTHING;

-- Función para generar folio único
CREATE OR REPLACE FUNCTION generar_folio_ticket()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  nuevo_folio text;
  existe boolean;
BEGIN
  LOOP
    -- Generar folio de 6 caracteres alfanuméricos (TK + 5 caracteres)
    nuevo_folio := 'TK' || upper(substring(md5(random()::text) from 1 for 5));
    
    -- Verificar si ya existe
    SELECT EXISTS(SELECT 1 FROM tickets WHERE folio = nuevo_folio) INTO existe;
    
    EXIT WHEN NOT existe;
  END LOOP;
  
  RETURN nuevo_folio;
END;
$$;

-- Trigger para generar folio automáticamente
CREATE OR REPLACE FUNCTION set_ticket_folio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    NEW.folio := generar_folio_ticket();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_ticket_folio
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_folio();

-- Trigger para actualizar ultima_modificacion
CREATE OR REPLACE FUNCTION update_ticket_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.ultima_modificacion := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_modificacion
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_modificacion();

-- Trigger para registrar cambios en historial
CREATE OR REPLACE FUNCTION log_ticket_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  accion_texto text;
  detalle_json jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    accion_texto := 'Ticket creado';
    detalle_json := jsonb_build_object(
      'folio', NEW.folio,
      'agente_id', NEW.agente_id,
      'estatus_id', NEW.estatus_id,
      'prioridad', NEW.prioridad
    );
    
    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
    VALUES (NEW.id, NEW.creado_por, accion_texto, detalle_json);
    
  ELSIF TG_OP = 'UPDATE' THEN
    detalle_json := '{}'::jsonb;
    
    IF OLD.estatus_id != NEW.estatus_id THEN
      accion_texto := 'Estatus actualizado';
      detalle_json := jsonb_build_object('estatus_anterior', OLD.estatus_id, 'estatus_nuevo', NEW.estatus_id);
    ELSIF OLD.prioridad != NEW.prioridad THEN
      accion_texto := 'Prioridad actualizada';
      detalle_json := jsonb_build_object('prioridad_anterior', OLD.prioridad, 'prioridad_nueva', NEW.prioridad);
    ELSIF OLD.cerrado_en IS NULL AND NEW.cerrado_en IS NOT NULL THEN
      accion_texto := 'Ticket cerrado';
      detalle_json := jsonb_build_object('cerrado_por', NEW.cerrado_por);
    ELSIF OLD.cerrado_en IS NOT NULL AND NEW.cerrado_en IS NULL THEN
      accion_texto := 'Ticket reabierto';
    ELSE
      accion_texto := 'Ticket actualizado';
    END IF;
    
    INSERT INTO ticket_historial (ticket_id, usuario_id, accion, detalle)
    VALUES (NEW.id, NEW.modificado_por, accion_texto, detalle_json);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_ticket_cambio
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_cambio();