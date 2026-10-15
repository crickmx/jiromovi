/*
  # Fix SICAS Documents RLS Performance

  1. Problem
    - The gerente RLS policy has a cartesian join (sicas_mapeo_despacho_oficina JOIN sicas_mapeo_vendedor_usuario ON true)
    - This causes every row check to scan the entire mapping tables
    - Result: SELECT queries timeout on 100K+ rows

  2. Solution
    - Replace the gerente policy with a simpler version that only checks oficina_id
    - Documents already have oficina_id populated during sync, so the complex subquery is unnecessary
    - Also add a composite index for the common query pattern (oficina_id + fecha_captura)

  3. Security
    - Gerentes still only see documents from their office
    - The existing oficina_id check is sufficient since sync already maps correctly
    - No data exposure change - just removing redundant checks that caused perf issues

  4. Performance
    - Adds composite index (oficina_id, fecha_captura DESC) for paginated queries
    - Adds composite index (vend_id, fecha_captura DESC) for agent-scoped queries
    - Simplifies gerente RLS to avoid cartesian product
*/

-- Add composite indexes for common query patterns (scope + sort)
CREATE INDEX IF NOT EXISTS idx_sicas_docs_oficina_fecha_captura
  ON sicas_documents(oficina_id, fecha_captura DESC);

CREATE INDEX IF NOT EXISTS idx_sicas_docs_vend_fecha_captura
  ON sicas_documents(vend_id, fecha_captura DESC);

CREATE INDEX IF NOT EXISTS idx_sicas_docs_fecha_captura_desc
  ON sicas_documents(fecha_captura DESC);

-- Fix the gerente RLS policy: remove the cartesian join
DROP POLICY IF EXISTS "sicas_docs_gerente_select" ON sicas_documents;

CREATE POLICY "sicas_docs_gerente_select"
  ON sicas_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol = 'Gerente'
        AND usuarios.oficina_id IS NOT NULL
        AND sicas_documents.oficina_id = usuarios.oficina_id
    )
  );

-- Fix the agente RLS policy: simplify to avoid ilike on every row
DROP POLICY IF EXISTS "sicas_docs_agente_select" ON sicas_documents;

CREATE POLICY "sicas_docs_agente_select"
  ON sicas_documents
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.rol = 'Agente'
        AND (
          (u.id_sicas IS NOT NULL AND u.id_sicas = sicas_documents.vend_id)
          OR EXISTS (
            SELECT 1 FROM sicas_mapeo_vendedor_usuario mvu
            WHERE mvu.movi_user_id = u.id
              AND mvu.id_sicas_vendedor = sicas_documents.vend_id
          )
        )
    )
  );
