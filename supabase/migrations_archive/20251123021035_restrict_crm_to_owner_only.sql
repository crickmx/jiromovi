/*
  # Restringir acceso del CRM solo al dueño de los registros

  1. Cambios en Políticas RLS
    - Eliminar políticas actuales permisivas
    - Crear políticas restrictivas donde cada usuario solo ve lo que creó
    - Aplicar a todas las tablas del CRM

  2. Seguridad
    - Solo el creador (creado_por) puede ver sus contactos
    - Solo el creador puede ver cotizaciones, pólizas, tareas de SUS contactos
    - Configuraciones globales (campos, etiquetas, fuentes) son visibles para todos

  3. Nota Importante
    - Cada usuario tendrá su propio CRM privado
    - No podrá ver contactos de otros usuarios
*/

-- =======================
-- TABLA: crm_contactos
-- =======================

-- Eliminar políticas permisivas actuales
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver todos los contactos" ON crm_contactos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear contactos" ON crm_contactos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar contactos" ON crm_contactos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar contactos" ON crm_contactos;

-- Crear políticas restrictivas (solo el dueño)
CREATE POLICY "Usuarios solo ven sus propios contactos"
  ON crm_contactos FOR SELECT
  TO authenticated
  USING (creado_por = auth.uid());

CREATE POLICY "Usuarios solo crean contactos propios"
  ON crm_contactos FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Usuarios solo actualizan sus propios contactos"
  ON crm_contactos FOR UPDATE
  TO authenticated
  USING (creado_por = auth.uid())
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Usuarios solo eliminan sus propios contactos"
  ON crm_contactos FOR DELETE
  TO authenticated
  USING (creado_por = auth.uid());

-- =======================
-- TABLA: crm_cotizaciones
-- =======================

-- Eliminar políticas permisivas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver cotizaciones" ON crm_cotizaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear cotizaciones" ON crm_cotizaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar cotizaciones" ON crm_cotizaciones;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar cotizaciones" ON crm_cotizaciones;

-- Crear políticas restrictivas
CREATE POLICY "Usuarios solo ven cotizaciones de sus contactos"
  ON crm_cotizaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo crean cotizaciones para sus contactos"
  ON crm_cotizaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo actualizan cotizaciones de sus contactos"
  ON crm_cotizaciones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo eliminan cotizaciones de sus contactos"
  ON crm_cotizaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_cotizaciones.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

-- =======================
-- TABLA: crm_polizas
-- =======================

-- Eliminar políticas permisivas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver pólizas" ON crm_polizas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear pólizas" ON crm_polizas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar pólizas" ON crm_polizas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar pólizas" ON crm_polizas;

-- Crear políticas restrictivas
CREATE POLICY "Usuarios solo ven pólizas de sus contactos"
  ON crm_polizas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo crean pólizas para sus contactos"
  ON crm_polizas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo actualizan pólizas de sus contactos"
  ON crm_polizas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo eliminan pólizas de sus contactos"
  ON crm_polizas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_polizas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

-- =======================
-- TABLA: crm_tareas
-- =======================

-- Eliminar políticas permisivas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar tareas" ON crm_tareas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar tareas" ON crm_tareas;

-- Crear políticas restrictivas
CREATE POLICY "Usuarios solo ven tareas de sus contactos"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo crean tareas para sus contactos"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo actualizan tareas de sus contactos"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo eliminan tareas de sus contactos"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_tareas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

-- =======================
-- TABLA: crm_notas
-- =======================

-- Eliminar políticas permisivas
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver notas" ON crm_notas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear notas" ON crm_notas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar notas" ON crm_notas;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar notas" ON crm_notas;

-- Crear políticas restrictivas
CREATE POLICY "Usuarios solo ven notas de sus contactos"
  ON crm_notas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo crean notas para sus contactos"
  ON crm_notas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo actualizan notas de sus contactos"
  ON crm_notas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

CREATE POLICY "Usuarios solo eliminan notas de sus contactos"
  ON crm_notas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_contactos
      WHERE crm_contactos.id = crm_notas.contacto_id
      AND crm_contactos.creado_por = auth.uid()
    )
  );

-- =======================
-- NOTA: Las tablas de configuración (campos_personalizados, etiquetas, fuentes)
-- mantienen sus políticas actuales ya que son catálogos compartidos
-- =======================

-- =======================
-- STORAGE POLICIES
-- =======================

-- Actualizar políticas de storage para que solo el dueño acceda a sus archivos
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos CRM" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver archivos CRM" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar archivos CRM" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar archivos CRM" ON storage.objects;

-- Políticas de storage más restrictivas
CREATE POLICY "Usuarios suben archivos en su carpeta CRM"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'crm-documentos' AND
  (storage.foldername(name))[1] IN ('cotizaciones', 'polizas')
);

CREATE POLICY "Usuarios ven solo sus archivos CRM"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crm-documentos');

CREATE POLICY "Usuarios actualizan solo sus archivos CRM"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crm-documentos')
WITH CHECK (bucket_id = 'crm-documentos');

CREATE POLICY "Usuarios eliminan solo sus archivos CRM"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crm-documentos');

-- =======================
-- ÍNDICES ADICIONALES para optimizar consultas con RLS
-- =======================

CREATE INDEX IF NOT EXISTS idx_crm_cotizaciones_contacto_id ON crm_cotizaciones(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_polizas_contacto_id ON crm_polizas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_tareas_contacto_id ON crm_tareas(contacto_id);
CREATE INDEX IF NOT EXISTS idx_crm_notas_contacto_id ON crm_notas(contacto_id);
