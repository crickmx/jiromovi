/*
  # Tabla de Mapping Persistente Vendor → Usuario MOVI
  
  ## Descripción
  Almacena las asignaciones manuales de vendor_key (especialmente "name:VENDEDOR" del formato LOGEXPORT)
  a usuarios MOVI. Esto permite que futuras importaciones con el mismo VendNombre se asignen
  automáticamente al mismo agente.
  
  ## Campos
  - id: UUID, primary key
  - vendor_key: text, clave única del vendedor (ej: "name:JUAN PEREZ", "email:juan@mail.com")
  - vendor_name_raw: text, nombre original del vendedor (opcional, para referencia)
  - vendor_email_raw: text, email original del vendedor (opcional, para referencia)
  - movi_user_id: uuid, FK a usuarios (agente MOVI asignado)
  - match_source: text, origen del match ('manual', 'auto_email', 'auto_name')
  - assigned_by: uuid, FK a usuarios (admin que hizo la asignación manual)
  - assigned_at: timestamptz, fecha de asignación
  - usage_count: integer, contador de veces que se ha usado este mapping
  - last_used_at: timestamptz, última vez que se usó
  - is_active: boolean, si el mapping está activo
  - notes: text, notas del admin (opcional)
  
  ## Índices
  - vendor_key único
  - movi_user_id para búsquedas inversas
  - vendor_name_raw para búsquedas por nombre
  
  ## RLS
  - Solo admins pueden crear/modificar
  - Todos los autenticados pueden leer
*/

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS vendor_mapping_persistent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_key text NOT NULL,
  vendor_name_raw text,
  vendor_email_raw text,
  movi_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  match_source text NOT NULL DEFAULT 'manual' CHECK (match_source IN ('manual', 'auto_email', 'auto_name', 'imported')),
  assigned_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índice único en vendor_key (solo puede haber un mapping activo por vendor)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_mapping_vendor_key_unique 
  ON vendor_mapping_persistent(vendor_key) 
  WHERE is_active = true;

-- Índice en movi_user_id para búsquedas inversas
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_movi_user_id 
  ON vendor_mapping_persistent(movi_user_id);

-- Índice en vendor_name_raw para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_vendor_mapping_vendor_name_raw 
  ON vendor_mapping_persistent(vendor_name_raw);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_vendor_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_mapping_updated_at ON vendor_mapping_persistent;
CREATE TRIGGER trigger_vendor_mapping_updated_at
  BEFORE UPDATE ON vendor_mapping_persistent
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_mapping_updated_at();

-- RLS
ALTER TABLE vendor_mapping_persistent ENABLE ROW LEVEL SECURITY;

-- Policy: todos los autenticados pueden leer
CREATE POLICY "Authenticated users can view vendor mappings"
  ON vendor_mapping_persistent
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: solo admins pueden insertar
CREATE POLICY "Admins can create vendor mappings"
  ON vendor_mapping_persistent
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Policy: solo admins pueden actualizar
CREATE POLICY "Admins can update vendor mappings"
  ON vendor_mapping_persistent
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Policy: solo admins pueden eliminar
CREATE POLICY "Admins can delete vendor mappings"
  ON vendor_mapping_persistent
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Función helper: aplicar mapping a items pendientes
CREATE OR REPLACE FUNCTION apply_vendor_mapping_to_batch(
  p_batch_id uuid,
  p_vendor_key text,
  p_movi_user_id uuid,
  p_assigned_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_updated_count integer;
  v_mapping_id uuid;
BEGIN
  -- Crear o actualizar el mapping persistente
  INSERT INTO vendor_mapping_persistent (
    vendor_key,
    movi_user_id,
    match_source,
    assigned_by,
    usage_count,
    last_used_at,
    is_active
  ) VALUES (
    p_vendor_key,
    p_movi_user_id,
    'manual',
    p_assigned_by,
    1,
    now(),
    true
  )
  ON CONFLICT (vendor_key) WHERE is_active = true
  DO UPDATE SET
    movi_user_id = p_movi_user_id,
    assigned_by = p_assigned_by,
    usage_count = vendor_mapping_persistent.usage_count + 1,
    last_used_at = now(),
    updated_at = now()
  RETURNING id INTO v_mapping_id;

  -- Aplicar el mapping a todos los items del lote con ese vendor_key
  UPDATE commission_details
  SET 
    agent_id = p_movi_user_id,
    movi_user_id = p_movi_user_id,
    pending_assignment = false,
    match_method = 'manual',
    assignment_status = 'assigned'
  WHERE 
    batch_id = p_batch_id
    AND vendor_key = p_vendor_key
    AND pending_assignment = true;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Actualizar contadores del lote
  UPDATE commission_batches
  SET 
    pending_count = (
      SELECT COUNT(*) 
      FROM commission_details 
      WHERE batch_id = p_batch_id AND pending_assignment = true
    ),
    has_pending_assignments = (
      SELECT COUNT(*) > 0 
      FROM commission_details 
      WHERE batch_id = p_batch_id AND pending_assignment = true
    ),
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'mapping_id', v_mapping_id,
    'updated_count', v_updated_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper: obtener vendedores no reconocidos de un lote
CREATE OR REPLACE FUNCTION get_unrecognized_vendors_for_batch(p_batch_id uuid)
RETURNS TABLE (
  vendor_key text,
  vendor_name_raw text,
  vendor_email_raw text,
  items_count bigint,
  total_commission double precision,
  has_existing_mapping boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cd.vendor_key,
    MAX(cd.vendor_name_raw) as vendor_name_raw,
    MAX(cd.vendor_email_raw) as vendor_email_raw,
    COUNT(*) as items_count,
    SUM(COALESCE(cd.commission_calculada, cd.commission_bruta, 0)) as total_commission,
    EXISTS (
      SELECT 1 FROM vendor_mapping_persistent vmp
      WHERE vmp.vendor_key = cd.vendor_key
      AND vmp.is_active = true
    ) as has_existing_mapping
  FROM commission_details cd
  WHERE 
    cd.batch_id = p_batch_id
    AND cd.pending_assignment = true
    AND cd.vendor_key IS NOT NULL
  GROUP BY cd.vendor_key
  ORDER BY items_count DESC, total_commission DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE vendor_mapping_persistent IS 'Mapeos persistentes de vendor_key a usuarios MOVI para auto-asignación en futuras importaciones';
COMMENT ON FUNCTION apply_vendor_mapping_to_batch IS 'Aplica un mapping vendor→usuario a todos los items pendientes de un lote y lo guarda como mapping persistente';
COMMENT ON FUNCTION get_unrecognized_vendors_for_batch IS 'Obtiene lista de vendedores no reconocidos en un lote, agrupados y con totales';
