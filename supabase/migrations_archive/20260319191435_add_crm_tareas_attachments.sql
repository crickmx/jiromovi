/*
  # Agregar sistema de adjuntos para tareas CRM

  1. Nueva Tabla
    - `crm_tareas_adjuntos`: Documentos adjuntos de tareas (máximo 5 por tarea)
      - `id` (uuid, primary key)
      - `tarea_id` (uuid, foreign key a crm_tareas)
      - `nombre_archivo` (text)
      - `archivo_url` (text)
      - `tipo_mime` (text)
      - `tamano_bytes` (bigint)
      - `subido_por` (uuid, foreign key a usuarios)
      - `creado_en` (timestamptz)

  2. Storage Bucket
    - Crear bucket `crm-tareas-adjuntos` para archivos
    - Políticas de acceso para subir, leer y eliminar archivos

  3. Security
    - RLS habilitado en crm_tareas_adjuntos
    - Solo miembros del tablero o propietario de la tarea pueden ver/modificar adjuntos
    - Límite de 5 adjuntos por tarea mediante constraint

  4. Índices
    - Índice en tarea_id para búsquedas rápidas
*/

-- =======================
-- TABLA: crm_tareas_adjuntos
-- =======================

CREATE TABLE IF NOT EXISTS crm_tareas_adjuntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES crm_tareas(id) ON DELETE CASCADE,
  nombre_archivo TEXT NOT NULL,
  archivo_url TEXT NOT NULL,
  tipo_mime TEXT,
  tamano_bytes BIGINT,
  subido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsquedas por tarea
CREATE INDEX IF NOT EXISTS idx_crm_tareas_adjuntos_tarea_id ON crm_tareas_adjuntos(tarea_id);

-- =======================
-- FUNCIÓN: Validar máximo 5 adjuntos por tarea
-- =======================

CREATE OR REPLACE FUNCTION validar_limite_adjuntos_tarea()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM crm_tareas_adjuntos WHERE tarea_id = NEW.tarea_id) >= 5 THEN
    RAISE EXCEPTION 'No se pueden agregar más de 5 adjuntos por tarea';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar límite antes de insertar
DROP TRIGGER IF EXISTS trigger_validar_limite_adjuntos_tarea ON crm_tareas_adjuntos;
CREATE TRIGGER trigger_validar_limite_adjuntos_tarea
  BEFORE INSERT ON crm_tareas_adjuntos
  FOR EACH ROW
  EXECUTE FUNCTION validar_limite_adjuntos_tarea();

-- =======================
-- RLS POLICIES
-- =======================

ALTER TABLE crm_tareas_adjuntos ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver adjuntos de tareas que les pertenecen o de tableros compartidos
CREATE POLICY "Users can view task attachments they own or from shared boards"
  ON crm_tareas_adjuntos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM crm_tareas t
      WHERE t.id = crm_tareas_adjuntos.tarea_id
      AND (
        -- Tareas propias (sin tablero)
        (t.board_id IS NULL AND t.creado_por = auth.uid())
        OR
        -- Tareas de tableros donde soy miembro
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_board_members bm
          WHERE bm.board_id = t.board_id
          AND bm.user_id = auth.uid()
        ))
        OR
        -- Tareas de tableros que yo creé
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_boards b
          WHERE b.id = t.board_id
          AND b.owner_user_id = auth.uid()
        ))
      )
    )
  );

-- Los usuarios pueden insertar adjuntos en tareas que les pertenecen o de tableros compartidos con permisos
CREATE POLICY "Users can insert task attachments they own or from shared boards"
  ON crm_tareas_adjuntos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM crm_tareas t
      WHERE t.id = crm_tareas_adjuntos.tarea_id
      AND (
        -- Tareas propias (sin tablero)
        (t.board_id IS NULL AND t.creado_por = auth.uid())
        OR
        -- Tareas de tableros donde tengo permisos de edición
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_board_members bm
          WHERE bm.board_id = t.board_id
          AND bm.user_id = auth.uid()
          AND bm.member_role IN ('owner', 'admin', 'editor')
        ))
        OR
        -- Tareas de tableros que yo creé
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_boards b
          WHERE b.id = t.board_id
          AND b.owner_user_id = auth.uid()
        ))
      )
    )
  );

-- Los usuarios pueden eliminar adjuntos que subieron o si tienen permisos en el tablero
CREATE POLICY "Users can delete their own attachments or if board admin"
  ON crm_tareas_adjuntos FOR DELETE
  TO authenticated
  USING (
    -- Propio adjunto
    subido_por = auth.uid()
    OR
    -- Admin/owner del tablero
    EXISTS (
      SELECT 1 FROM crm_tareas t
      WHERE t.id = crm_tareas_adjuntos.tarea_id
      AND (
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_board_members bm
          WHERE bm.board_id = t.board_id
          AND bm.user_id = auth.uid()
          AND bm.member_role IN ('owner', 'admin')
        ))
        OR
        (t.board_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM crm_boards b
          WHERE b.id = t.board_id
          AND b.owner_user_id = auth.uid()
        ))
        OR
        (t.board_id IS NULL AND t.creado_por = auth.uid())
      )
    )
  );

-- =======================
-- STORAGE BUCKET
-- =======================

-- Crear bucket para adjuntos de tareas CRM
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-tareas-adjuntos',
  'crm-tareas-adjuntos',
  false,
  10485760, -- 10MB por archivo
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- =======================
-- STORAGE POLICIES
-- =======================

-- Permitir subir archivos a usuarios autenticados
CREATE POLICY "Users can upload task attachments to their tasks"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crm-tareas-adjuntos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Permitir leer archivos de tareas propias o de tableros compartidos
CREATE POLICY "Users can view task attachments from their tasks or shared boards"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crm-tareas-adjuntos'
    AND (
      -- El archivo está en mi carpeta
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- O pertenece a una tarea de un tablero compartido
      EXISTS (
        SELECT 1 FROM crm_tareas_adjuntos adj
        JOIN crm_tareas t ON t.id = adj.tarea_id
        WHERE adj.archivo_url LIKE '%' || (storage.objects.name) || '%'
        AND (
          (t.board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM crm_board_members bm
            WHERE bm.board_id = t.board_id
            AND bm.user_id = auth.uid()
          ))
          OR
          (t.board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM crm_boards b
            WHERE b.id = t.board_id
            AND b.owner_user_id = auth.uid()
          ))
          OR
          (t.board_id IS NULL AND t.creado_por = auth.uid())
        )
      )
    )
  );

-- Permitir eliminar archivos propios o si es admin del tablero
CREATE POLICY "Users can delete their own task attachments or if board admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crm-tareas-adjuntos'
    AND (
      -- Es mi archivo
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Soy admin del tablero de la tarea
      EXISTS (
        SELECT 1 FROM crm_tareas_adjuntos adj
        JOIN crm_tareas t ON t.id = adj.tarea_id
        WHERE adj.archivo_url LIKE '%' || (storage.objects.name) || '%'
        AND (
          (t.board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM crm_board_members bm
            WHERE bm.board_id = t.board_id
            AND bm.user_id = auth.uid()
            AND bm.member_role IN ('owner', 'admin')
          ))
          OR
          (t.board_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM crm_boards b
            WHERE b.id = t.board_id
            AND b.owner_user_id = auth.uid()
          ))
          OR
          (t.board_id IS NULL AND t.creado_por = auth.uid())
        )
      )
    )
  );
