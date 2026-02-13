/*
  # Arreglar Políticas RLS de SICAS - Roles Correctos

  1. Problema
    - Las políticas RLS buscan roles 'admin', 'gerente' en minúsculas
    - Los roles reales son 'Administrador', 'Gerente' con mayúsculas

  2. Solución
    - Actualizar políticas para usar los nombres de roles correctos
*/

-- =====================================================
-- SICAS Documents
-- =====================================================
DROP POLICY IF EXISTS "Users can view own documents" ON sicas_documents;

CREATE POLICY "Users can view own documents"
  ON sicas_documents FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- SICAS Commissions
-- =====================================================
DROP POLICY IF EXISTS "Users can view own commissions" ON sicas_commissions;

CREATE POLICY "Users can view own commissions"
  ON sicas_commissions FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );

-- =====================================================
-- SICAS Receivables
-- =====================================================
DROP POLICY IF EXISTS "Users can view own receivables" ON sicas_receivables;

CREATE POLICY "Users can view own receivables"
  ON sicas_receivables FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol IN ('Administrador', 'Gerente')
    )
  );
